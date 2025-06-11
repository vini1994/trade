import { TradeDatabase } from './TradeDatabase';
import { OrderStatusChecker } from './OrderStatusChecker';
import { BingXOrderExecutor } from './BingXOrderExecutor';
import { MonitoredPosition } from './utils/types';
import { normalizeSymbolBingX } from './utils/bingxUtils';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface TradeRecord {
    id: number;
    symbol: string;
    type: 'LONG' | 'SHORT';
    entry: number;
    stop: number;
    tp1: number | null;
    tp2: number | null;
    tp3: number | null;
    tp4: number | null;
    tp5: number | null;
    tp6: number | null;
    entryOrderId: string;
    stopOrderId: string;
    tp1OrderId: string | null;
    tp2OrderId: string | null;
    tp3OrderId: string | null;
    tp4OrderId: string | null;
    tp5OrderId: string | null;
    tp6OrderId: string | null;
    trailingStopOrderId: string | null;
    quantity: number;
    leverage: number;
    status: 'OPEN' | 'CLOSED';
    volume_adds_margin: boolean;
    setup_description: string | null;
    volume_required: boolean;
}

export class TradeOrderProcessor {
    private readonly tradeDatabase: TradeDatabase;
    private readonly orderStatusChecker: OrderStatusChecker;
    private readonly orderExecutor: BingXOrderExecutor;
    private readonly limitOrderFee: number;
    private readonly marketOrderFee: number;

    constructor() {
        this.tradeDatabase = new TradeDatabase();
        this.orderStatusChecker = new OrderStatusChecker();
        this.orderExecutor = new BingXOrderExecutor();
        this.limitOrderFee = parseFloat(process.env.BINGX_LIMIT_ORDER_FEE || '0.0002');
        this.marketOrderFee = parseFloat(process.env.BINGX_MARKET_ORDER_FEE || '0.0005');
    }

    private getPositionKey(symbol: string, positionSide: 'LONG' | 'SHORT'): string {
        const normalizedSymbol = normalizeSymbolBingX(symbol);
        return `${normalizedSymbol}_${positionSide}`;
    }

    public async processTrades(monitoredPositions: Map<string, MonitoredPosition>): Promise<void> {
        try {

            // Get all open trades from the database
            const openTrades = await this.tradeDatabase.getOpenTrades();
            console.log(`Found ${openTrades.length} open trades to process`);

            for (const trade of openTrades) {
            
                if (monitoredPositions.size !== 0) {
                    // Check if trade has a monitored position using both symbol and positionSide
                    const positionKey = this.getPositionKey(trade.symbol, trade.type);
                    const monitoredPosition = monitoredPositions.get(positionKey);
                    
                    if (!monitoredPosition) {
                        console.log(`No monitored position found for trade ${trade.id} (${trade.symbol} ${trade.type}), cancelling orders and closing trade`);
                        await this.cancelAndCloseTrade(trade);
                        continue;
                    }

                }


                await this.processTrade(trade);
            }
        } catch (error) {
            console.error('Error processing trades:', error);
            throw error;
        }
    }

    private async cancelAndCloseTrade(trade: TradeRecord): Promise<void> {
        try {
            // Collect all active order IDs that need to be cancelled
            /*
            const orderIds = [
                trade.entryOrderId,
                trade.stopOrderId,
                trade.tp1OrderId,
                trade.tp2OrderId,
                trade.tp3OrderId,
                trade.tp4OrderId,
                trade.tp5OrderId,
                trade.tp6OrderId,
                trade.trailingStopOrderId
            ].filter(id => id !== null);

            // Get status for all orders
            const orderStatuses = await this.orderStatusChecker.getMultipleOrderStatus(orderIds);

            // Cancel all active orders
            for (const [orderId, status] of orderStatuses) {
                if (status && status.status === 'NEW') {
                    console.log(`Cancelling order ${orderId} for trade ${trade.id}`);
                    await this.orderExecutor.cancelOrder(trade.symbol, orderId);
                }
            }
            */
            // Mark trade as closed
            await this.tradeDatabase.updateTradeStatus(trade.id, 'CLOSED');
            console.log(`Trade ${trade.id} marked as CLOSED due to no monitored position`);
        } catch (error) {
            console.error(`Error cancelling and closing trade ${trade.id}:`, error);
            throw error;
        }
    }

    private async processTrade(trade: TradeRecord): Promise<void> {
        try {
            // Collect all order IDs that need to be checked
            const allOrderIds = [
                trade.entryOrderId,
                trade.stopOrderId,
                trade.tp1OrderId,
                trade.tp2OrderId,
                trade.tp3OrderId,
                trade.tp4OrderId,
                trade.tp5OrderId,
                trade.tp6OrderId,
                trade.trailingStopOrderId
            ];
            
            const orderIds: string[] = allOrderIds
                .filter((id): id is string => id !== null && id !== 'pending');

            // Get status for all orders
            const orderStatuses = await this.orderStatusChecker.getMultipleOrderStatus(orderIds);

            // Process each order status
            for (const [orderId, status] of orderStatuses) {
                if (!status) {
                    console.warn(`No status found for order ${orderId}`);
                    continue;
                }

                // Skip orders that are in NEW status
                if (status.status === 'NEW') {
                    console.log(`Order ${orderId} has NEW status, skipping`);
                    continue;
                }

                // Skip orders that already have details in the database
                const hasDetails = await this.tradeDatabase.hasOrderDetails(orderId);
                if (hasDetails) {
                    console.log(`Order ${orderId} already has details in database, skipping`);
                    continue;
                }

                // Get detailed status information
                const details = await this.orderStatusChecker.getOrderStatusWithDetails(orderId);
                console.log(`Order ${orderId} details:`, details);

                // Calculate PnL, fee, and result
                let pnl = 0;
                let fee = 0;
                let feeType: 'LIMIT' | 'MAKER' | undefined;
                let result = 0;

                if (details.isFilled) {
                    // Determine fee type based on order type
                    feeType = status.type === 'LIMIT' ? 'LIMIT' : 'MAKER';
                    const feeRate = feeType === 'LIMIT' ? this.limitOrderFee : this.marketOrderFee;

                    // Calculate fee with leverage
                    const orderValue = details.executionDetails.executedQuantity * details.executionDetails.averagePrice;
                    const leveragedOrderValue = orderValue * trade.leverage;
                    fee = leveragedOrderValue * feeRate;

                    // Calculate PnL for stop and take profit orders with leverage
                    if (orderId === trade.stopOrderId || 
                        orderId === trade.tp1OrderId || 
                        orderId === trade.tp2OrderId || 
                        orderId === trade.tp3OrderId ||
                        orderId === trade.tp4OrderId ||
                        orderId === trade.tp5OrderId ||
                        orderId === trade.tp6OrderId) {
                        
                        const entryPrice = trade.entry;
                        const exitPrice = details.executionDetails.averagePrice;
                        const quantity = details.executionDetails.executedQuantity;
                        const leverage = trade.leverage;

                        if (trade.type === 'LONG') {
                            pnl = (exitPrice - entryPrice) * quantity * leverage;
                        } else {
                            pnl = (entryPrice - exitPrice) * quantity * leverage;
                        }

                        // Calculate final result (PnL - fee)
                        result = pnl - fee;

                        // Log additional information for take profit orders
                        if (orderId !== trade.stopOrderId) {
                            const tpNumber = [
                                trade.tp1OrderId,
                                trade.tp2OrderId,
                                trade.tp3OrderId,
                                trade.tp4OrderId,
                                trade.tp5OrderId,
                                trade.tp6OrderId
                            ].indexOf(orderId) + 1;

                            console.log(`Take Profit ${tpNumber} executed:`);
                            console.log(`- Target Price: ${trade[`tp${tpNumber}` as keyof TradeRecord]}`);
                            console.log(`- Executed Price: ${exitPrice}`);
                            console.log(`- Quantity: ${quantity}`);
                            console.log(`- PnL: ${pnl.toFixed(2)}`);
                            console.log(`- Fee: ${fee.toFixed(2)}`);
                            console.log(`- Result: ${result.toFixed(2)}`);
                        }
                    }
                }

                // Save order details to database
                await this.tradeDatabase.saveOrderDetails(trade.id, orderId, {
                    status: details.status.status,
                    executedQuantity: details.executionDetails.executedQuantity,
                    averagePrice: details.executionDetails.averagePrice,
                    createTime: details.executionDetails.createTime,
                    updateTime: details.executionDetails.updateTime,
                    isFilled: details.isFilled,
                    isCanceled: details.isCanceled,
                    isOpen: details.isOpen,
                    pnl,
                    fee,
                    feeType,
                    result
                });

                // Only mark trade as CLOSED if the order is stop or trailingStop
                if (orderId === trade.stopOrderId || orderId === trade.trailingStopOrderId) {
                    await this.tradeDatabase.updateTradeStatus(trade.id, 'CLOSED');
                    console.log(`Trade ${trade.id} marked as CLOSED - ${orderId} is ${details.status.status}`);
                    if (pnl !== 0) {
                        console.log(`PnL: ${pnl.toFixed(2)}, Fee: ${fee.toFixed(2)}, Result: ${result.toFixed(2)}`);
                        console.log(`Leverage used: ${trade.leverage}x`);
                        if (trade.volume_adds_margin) {
                            console.log(`Volume Margin was enabled for this trade`);
                        }
                        if (trade.setup_description) {
                            console.log(`Setup Description: ${trade.setup_description}`);
                        }
                    }
                } else {
                    console.log(`Trade ${trade.id} remains open - ${orderId} is ${details.status.status}`);
                }
            }
        } catch (error) {
            console.error(`Error processing trade ${trade.id}:`, error);
        }
    }
} 