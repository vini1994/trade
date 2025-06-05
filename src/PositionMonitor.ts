import { PositionValidator } from './PositionValidator';
import { BingXWebSocket } from './BingXWebSocket';
import { TradeDatabase } from './TradeDatabase';
import { Position, MonitoredPosition } from './utils/types';
import { OrderMonitor, Order } from './OrderMonitor';
import { BingXOrderExecutor } from './BingXOrderExecutor';
import { normalizeSymbolBingX } from './utils/bingxUtils';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export class PositionMonitor {
    private positionValidator: PositionValidator;
    private tradeDatabase: TradeDatabase;
    private orderMonitor: OrderMonitor;
    private orderExecutor: BingXOrderExecutor;
    private monitoredPositions: Map<string, MonitoredPosition> = new Map();
    private onPriceUpdate?: (position: MonitoredPosition) => void;
    private readonly limitOrderFee: number;
    private readonly marketOrderFee: number;

    constructor(onPriceUpdate?: (position: MonitoredPosition) => void) {
        this.positionValidator = new PositionValidator();
        this.tradeDatabase = new TradeDatabase();
        this.orderMonitor = new OrderMonitor();
        this.orderExecutor = new BingXOrderExecutor();
        this.onPriceUpdate = onPriceUpdate;
        this.limitOrderFee = parseFloat(process.env.BINGX_LIMIT_ORDER_FEE || '0.0002');
        this.marketOrderFee = parseFloat(process.env.BINGX_MARKET_ORDER_FEE || '0.0005');
    }

    private getPositionKey(symbol: string, positionSide: 'LONG' | 'SHORT'): string {
        const normalizedSymbol = normalizeSymbolBingX(symbol);
        return `${normalizedSymbol}_${positionSide}`;
    }

    private async matchPositionWithTrade(position: Position): Promise<number | undefined> {
        const normalizedSymbol = normalizeSymbolBingX(position.symbol);
        const trades = await this.tradeDatabase.getOpenTrades();
        const matchingTrades = trades.filter(trade => 
            normalizeSymbolBingX(trade.symbol) === normalizedSymbol && 
            trade.type === position.positionSide
        );
        
        if (matchingTrades.length === 0) {
            return undefined;
        }
        
        // Return the trade with the maximum ID
        return Math.max(...matchingTrades.map(trade => trade.id));
    }

    private async updateMonitoredPosition(position: Position): Promise<void> {
        const positionKey = this.getPositionKey(position.symbol, position.positionSide);
        const existingPosition = this.monitoredPositions.get(positionKey);

        // Update open orders to get latest stop loss orders
        await this.orderMonitor.updateOpenOrders();
        let stopLossOrder = this.orderMonitor.getStopMarketOrder(position.symbol, position.positionSide);

        // Get trade info to get leverage and initial stop price
        const tradeId = await this.matchPositionWithTrade(position);
        let leverage: number | undefined;
        let initialStopPrice: number | undefined;
        if (tradeId) {
            const trade = await this.tradeDatabase.getTradeById(tradeId);
            leverage = parseFloat(position.leverage.toString());
            initialStopPrice = trade?.stop; // Using the 'stop' field from TradeRecord
            // If no stop loss order exists but we have a trade stop price, create one
            if (!stopLossOrder && initialStopPrice && parseFloat(position.positionAmt) !== 0) {
                try {
                    const newStopOrder = await this.orderExecutor.placeOrder(
                        position.symbol,
                        position.positionSide === 'LONG' ? 'SELL' : 'BUY',
                        position.positionSide,
                        'STOP',
                        initialStopPrice, // No price for STOP_MARKET orders
                        initialStopPrice,
                        parseFloat(position.positionAmt)
                    );

                    stopLossOrder = {
                        orderId: newStopOrder.data.order.orderId,
                        symbol: position.symbol,
                        side: position.positionSide === 'LONG' ? 'SELL' : 'BUY',
                        type: 'STOP',
                        price: initialStopPrice.toString(), // STOP_MARKET orders don't have a price
                        stopPrice: initialStopPrice.toString(),
                        quantity: position.positionAmt,
                        positionSide: position.positionSide,
                        status: 'NEW',
                        clientOrderId: newStopOrder.data.order.clientOrderId || '',
                        createTime: Date.now(),
                        updateTime: Date.now()
                    };

                    console.log(`Created new stop loss order for ${position.symbol} ${position.positionSide} at ${initialStopPrice}`);
                } catch (error) {
                    console.error(`Error creating stop loss order for ${position.symbol} ${position.positionSide}:`, error);
                }
            }
        }

        if (existingPosition) {
            // Update existing position
            existingPosition.position = position;
            existingPosition.stopLossOrder = stopLossOrder;
            existingPosition.leverage = leverage;
            existingPosition.entryPrice = parseFloat(position.avgPrice);
            if (stopLossOrder) {
                existingPosition.initialStopPrice = parseFloat(stopLossOrder.stopPrice);
            }

        }

        if (!existingPosition?.websocket){
            // Create new monitored position
            const websocket = this.createWebSocket(position.symbol, position.positionSide);

            this.monitoredPositions.set(positionKey, {
                symbol: position.symbol,
                positionSide: position.positionSide,
                position,
                websocket,
                tradeId,
                lastPrice: undefined,
                stopLossOrder,
                initialStopPrice: stopLossOrder ? parseFloat(stopLossOrder.stopPrice) : undefined,
                entryPrice: parseFloat(position.avgPrice),
                leverage
            });
        }
    }

    private async checkAndUpdateStopLoss(position: MonitoredPosition, currentPrice: number): Promise<void> {
        if (!position.initialStopPrice || !position.entryPrice || !position.stopLossOrder || !position.leverage) {
            return;
        }

        const entryPrice = position.entryPrice;
        const currentStopPrice = parseFloat(position.stopLossOrder.stopPrice);
        const positionSide = position.positionSide;
        const leverage = position.leverage;

        // Calculate risk (distance from entry to initial stop)
        const risk = Math.abs(entryPrice - currentStopPrice);
        
        // Calculate reward (distance from entry to current price)
        const reward = Math.abs(currentPrice - entryPrice);
        // Check if we've reached 1:1 risk/reward
        if (reward >= risk) {
            // Calculate breakeven + fees price considering leverage
            // For leveraged positions, fees are multiplied by leverage
            const feeRate = this.limitOrderFee * leverage; // Using limit order fee for stop loss
            const breakevenWithFees = positionSide === 'LONG' 
                ? entryPrice * (1 + feeRate) // For LONG, move stop above entry
                : entryPrice * (1 - feeRate); // For SHORT, move stop below entry

            // Only update if current stop is not already at or better than breakeven + fees
            const shouldUpdate = positionSide === 'LONG'
                ? currentStopPrice < breakevenWithFees
                : currentStopPrice > breakevenWithFees;

            if (shouldUpdate) {
                try {

                    // Place new stop loss order at breakeven + fees
                    const newStopOrder = await this.orderExecutor.cancelReplaceOrder(
                        position.symbol,
                        positionSide === 'LONG' ? 'SELL' : 'BUY',
                        positionSide,
                        'STOP',
                        breakevenWithFees, 
                        breakevenWithFees,
                        parseFloat(position.position.positionAmt),
                        position.tradeId,
                        position.stopLossOrder.orderId
                    );

                    // Update the monitored position with new stop loss order
                    position.stopLossOrder = {
                        ...position.stopLossOrder,
                        stopPrice: breakevenWithFees.toString()
                    };

                    console.log(`Updated stop loss to breakeven + fees (${feeRate * 100}%) for ${position.symbol} ${positionSide} at ${breakevenWithFees} (leverage: ${leverage}x)`);
                } catch (error) {
                    console.error(`Error updating stop loss for ${position.symbol} ${positionSide}:`, error);
                }
            }
        }
    }

    private createWebSocket(symbol: string, positionSide: 'LONG' | 'SHORT'): BingXWebSocket {
        const normalizedSymbol = normalizeSymbolBingX(symbol);
        const ws = new BingXWebSocket(normalizedSymbol, async (priceData) => {
            const positionKey = this.getPositionKey(normalizedSymbol, positionSide);
            const monitoredPosition = this.monitoredPositions.get(positionKey);
            
            if (monitoredPosition) {
                monitoredPosition.lastPrice = priceData.price;
                
                // Check and update stop loss if needed
                await this.checkAndUpdateStopLoss(monitoredPosition, priceData.price);
                
                if (this.onPriceUpdate) {
                    this.onPriceUpdate(monitoredPosition);
                }
            }
        });
        
        ws.connect();
        return ws;
    }

    private removeClosedPositions(currentPositions: Position[]): void {
        const currentPositionKeys = new Set(
            currentPositions.map(p => this.getPositionKey(p.symbol, p.positionSide))
        );

        // Remove positions that are no longer open
        for (const [positionKey, monitoredPosition] of this.monitoredPositions.entries()) {
            if (!currentPositionKeys.has(positionKey)) {
                monitoredPosition.websocket.disconnect();
                this.monitoredPositions.delete(positionKey);
            }
        }
    }

    public async updatePositions(): Promise<void> {
        try {
            // Get all open positions from BingX
            const positions = await this.positionValidator.getPositions('ALL');
            
            // Update open orders first
            await this.orderMonitor.updateOpenOrders();
            
            // Remove positions that are no longer open
            this.removeClosedPositions(positions);

            // Update or add new positions
            for (const position of positions) {
                if (parseFloat(position.positionAmt) !== 0) {
                    await this.updateMonitoredPosition(position);
                }
            }
        } catch (error) {
            console.error('Error updating positions:', error);
            throw error;
        }
    }

    public getMonitoredPositions(): MonitoredPosition[] {
        return Array.from(this.monitoredPositions.values());
    }

    public getMonitoredPosition(symbol: string, positionSide: 'LONG' | 'SHORT'): MonitoredPosition | undefined {
        return this.monitoredPositions.get(this.getPositionKey(symbol, positionSide));
    }

    public getMonitoredPositionsMap(): Map<string, MonitoredPosition> {
        return new Map(this.monitoredPositions);
    }

    public disconnect(): void {
        for (const monitoredPosition of this.monitoredPositions.values()) {
            monitoredPosition.websocket.disconnect();
        }
        this.monitoredPositions.clear();
    }
} 