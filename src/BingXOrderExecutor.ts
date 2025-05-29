import { BingXApiClient } from './services/BingXApiClient';
import { LeverageCalculator } from './LeverageCalculator';
import { PositionValidator } from './PositionValidator';
import { TradeDatabase } from './TradeDatabase';
import { normalizeSymbolBingX, getPairPrice } from './utils/bingxUtils';
import { Trade, BingXOrderResponse, TradeRecord, TradeExecutionResult } from './utils/types';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export class BingXOrderExecutor {
    private readonly apiClient: BingXApiClient;
    private readonly leverageCalculator: LeverageCalculator;
    private readonly positionValidator: PositionValidator;
    private readonly tradeDatabase: TradeDatabase;
    private readonly margin: number;
    private readonly volumeMarginPercentage: number;

    constructor() {
        // Initialize API client
        this.apiClient = new BingXApiClient();
        this.margin = parseFloat(process.env.BINGX_MARGIN || '500');
        this.volumeMarginPercentage = parseFloat(process.env.VOLUME_MARGIN_PERCENTAGE || '0');

        this.leverageCalculator = new LeverageCalculator();
        this.positionValidator = new PositionValidator();
        this.tradeDatabase = new TradeDatabase();
    }

    private async calculatePositionQuantity(pair: string, leverage: number, trade?: Trade): Promise<number> {
        try {
            const normalizedPair = normalizeSymbolBingX(pair);
            // Get current price
            const currentPrice = await getPairPrice(normalizedPair, this.apiClient);
            
            // Calculate base margin
            let totalMargin = this.margin;

            console.log(`currentPrice:${currentPrice}`)
            
            console.log(`margin:${this.margin}`)

            console.log(`volumeMarginPercentage:${this.volumeMarginPercentage}`)
            // Add volume-based margin if trade has volume_adds_margin
            if (trade?.volume_adds_margin) {
                const additionalMargin = this.margin * (this.volumeMarginPercentage / 100);
                totalMargin += additionalMargin;
            }
            console.log(`totalMargin:${totalMargin}`)
            console.log(`leverage:${leverage}`)
            
            // Calculate position value based on total margin and leverage
            const positionValue = totalMargin * leverage;
            
            console.log(`positionValue:${positionValue}`)
            // Calculate quantity based on position value and current price
            const quantity = positionValue / currentPrice;

            console.log(`quantity:${quantity}`)
            
            // Round to appropriate decimal places (usually 3 for most pairs)
            return Math.floor(quantity * 1000) / 1000;
        } catch (error) {
            console.error('Error calculating position quantity:', error);
            throw error;
        }
    }

    public async placeOrder(
        pair: string,
        side: 'BUY' | 'SELL',
        positionSide: 'LONG' | 'SHORT',
        type: 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_MARKET' | 'TRIGGER_LIMIT',
        price: number,
        stopPrice: number,
        quantity: number,
        tradeId?: number
    ): Promise<BingXOrderResponse> {
        const normalizedPair = normalizeSymbolBingX(pair);
        const path = '/openApi/swap/v2/trade/order';
        const params: any = {
            symbol: normalizedPair,
            side: side,
            positionSide: positionSide,
            type: type,
            price: price.toString(),
            stopPrice: stopPrice.toString(),
            quantity: quantity.toString()
        };

        // Add activationPrice for TRIGGER_LIMIT orders
        if (type === 'TRIGGER_LIMIT') {
            params.activationPrice = price.toString();
        }

        try {
            const response = await this.apiClient.post<BingXOrderResponse>(path, params);
            
            // Save log if tradeId is provided
            if (tradeId) {
                await this.tradeDatabase.saveTradeLog(
                    tradeId,
                    normalizedPair,
                    side,
                    positionSide,
                    type,
                    price || null,
                    stopPrice || null,
                    quantity,
                    response
                );
            }

            return response;
        } catch (error) {
            console.error('Error placing order:', error);
            throw error;
        }
    }

    private async placeTrailingStopOrder(
        pair: string,
        side: 'BUY' | 'SELL',
        positionSide: 'LONG' | 'SHORT',
        quantity: number,
        price: number,
        activationPrice: number,
        tradeId?: number
    ): Promise<BingXOrderResponse> {
        const normalizedPair = normalizeSymbolBingX(pair);
        const path = '/openApi/swap/v2/trade/order';
        const params: any = {
            symbol: normalizedPair,
            side: side,
            positionSide: positionSide,
            type: 'TRAILING_STOP_MARKET',
            quantity: quantity.toString(),
            price: price.toString(),
            activationPrice: activationPrice.toString()
        };

        try {
            const response = await this.apiClient.post<BingXOrderResponse>(path, params);
            
            // Save log if tradeId is provided
            if (tradeId) {
                await this.tradeDatabase.saveTradeLog(
                    tradeId,
                    normalizedPair,
                    side,
                    positionSide,
                    'TRAILING_STOP_MARKET',
                    price,
                    activationPrice,
                    quantity,
                    response
                );
            }

            return response;
        } catch (error) {
            console.error('Error placing trailing stop order:', error);
            throw error;
        }
    }

    private async placeTakeProfitOrders(trade: Trade, quantity: number, tradeId: number): Promise<BingXOrderResponse[]> {
        const tpOrders: BingXOrderResponse[] = [];
        const takeProfits = [
            { level: 1, price: trade.tp1 },
            { level: 2, price: trade.tp2 },
            { level: 3, price: trade.tp3 },
            { level: 4, price: trade.tp4 },
            { level: 5, price: trade.tp5 },
            { level: 6, price: trade.tp6 }
        ].filter(tp => tp.price !== null && tp.price > 0);

        if (takeProfits.length === 0) {
            // No take profits set, use trailing stop for entire position
            tpOrders.push(
                await this.placeTrailingStopOrder(
                    trade.symbol,
                    trade.type === 'LONG' ? 'SELL' : 'BUY',
                    trade.type,
                    quantity,
                    trade.entry, // Use entry price as activation price
                    tradeId
                )
            );
            return tpOrders;
        }

        // Calculate quantities based on number of take profits
        let remainingQuantity = quantity;
        const tpQuantities: number[] = [];

        if (takeProfits.length === 1) {
            // Single take profit: 90% of position
            tpQuantities.push(quantity * 0.9);
        } else if (takeProfits.length === 2) {
            // Two take profits: 50% and 90% of remaining
            tpQuantities.push(quantity * 0.5);
            tpQuantities.push(quantity * 0.45); // 90% of remaining 50%
        } else if (takeProfits.length === 3) {
            // Three take profits: 50%, 70% of remaining, 90% of remaining
            tpQuantities.push(quantity * 0.5);
            tpQuantities.push(quantity * 0.35); // 70% of remaining 50%
            tpQuantities.push(quantity * 0.15); // 90% of remaining 15%
        } else if (takeProfits.length === 4) {
            // Four take profits: 40%, 60% of remaining, 80% of remaining, 90% of remaining
            tpQuantities.push(quantity * 0.4);
            tpQuantities.push(quantity * 0.24); // 60% of remaining 60%
            tpQuantities.push(quantity * 0.24); // 80% of remaining 30%
            tpQuantities.push(quantity * 0.12); // 90% of remaining 12%
        } else if (takeProfits.length === 5) {
            // Five take profits: 30%, 45% of remaining, 60% of remaining, 75% of remaining, 90% of remaining
            tpQuantities.push(quantity * 0.3);
            tpQuantities.push(quantity * 0.21); // 45% of remaining 70%
            tpQuantities.push(quantity * 0.21); // 60% of remaining 49%
            tpQuantities.push(quantity * 0.15); // 75% of remaining 28%
            tpQuantities.push(quantity * 0.13); // 90% of remaining 15%
        } else if (takeProfits.length === 6) {
            // Six take profits: 25%, 40% of remaining, 55% of remaining, 70% of remaining, 85% of remaining, 95% of remaining
            tpQuantities.push(quantity * 0.25);
            tpQuantities.push(quantity * 0.18); // 40% of remaining 75%
            tpQuantities.push(quantity * 0.18); // 55% of remaining 57%
            tpQuantities.push(quantity * 0.15); // 70% of remaining 39%
            tpQuantities.push(quantity * 0.12); // 85% of remaining 24%
            tpQuantities.push(quantity * 0.12); // 95% of remaining 12%
        }

        // Place take profit orders
        for (let i = 0; i < takeProfits.length; i++) {
            const tp = takeProfits[i];
            const tpQuantity = tpQuantities[i];
            
            if (tpQuantity > 0) {
                tpOrders.push(
                    await this.placeOrder(
                        trade.symbol,
                        trade.type === 'LONG' ? 'SELL' : 'BUY',
                        trade.type,
                        'TRIGGER_LIMIT',
                        tp.price!,
                        tp.price!,
                        tpQuantity,
                        tradeId
                    )
                );
                remainingQuantity -= tpQuantity;
            }
        }

        // Add trailing stop for remaining quantity if any
        if (remainingQuantity > 0) {
            const lastTp = takeProfits[takeProfits.length - 1];
            tpOrders.push(
                await this.placeTrailingStopOrder(
                    trade.symbol,
                    trade.type === 'LONG' ? 'SELL' : 'BUY',
                    trade.type,
                    remainingQuantity,
                    trade.type === 'LONG' ? lastTp.price! - trade.entry : trade.entry - lastTp.price!,
                    lastTp.price!, // Use last take profit as activation price
                    tradeId
                )
            );
        }

        return tpOrders;
    }

    public async executeTrade(trade: Trade): Promise<{
        entryOrder: BingXOrderResponse;
        stopOrder: BingXOrderResponse;
        tpOrders: BingXOrderResponse[];
        leverage: {
            optimalLeverage: number;
            theoreticalMaxLeverage: number;
            exchangeMaxLeverage: number;
            stopLossPercentage: number;
        };
        quantity: number;
        tradeRecord: TradeRecord;
    }> {
        try {
            // Validate that at least tp1 is set
            if (!trade.tp1) {
                throw new Error('At least tp1 must be set for a trade');
            }

            // Check for existing position
            const { hasPosition, message } = await this.positionValidator.hasOpenPosition(trade.symbol, trade.type);
            
            if (hasPosition) {
                throw new Error(`Cannot execute trade: ${message}`);
            }

            // Calculate and set optimal leverage
            const leverageInfo = await this.leverageCalculator.calculateOptimalLeverage(
                trade.symbol,
                trade.entry,
                trade.stop,
                trade.type
            );
            
            console.log(`Calculated leverage info:`, leverageInfo);
            
            // Set leverage
            await this.leverageCalculator.setLeverage(
                trade.symbol, 
                leverageInfo.optimalLeverage,
                trade.type
            );

            // Calculate position quantity based on margin and leverage, passing the trade object
            const quantity = await this.calculatePositionQuantity(trade.symbol, leverageInfo.optimalLeverage, trade);
            console.log(`Calculated position quantity: ${quantity} based on margin ${this.margin} USDT and leverage ${leverageInfo.optimalLeverage}x`);

            // Save trade to database first to get the tradeId
            const tradeRecord = await this.tradeDatabase.saveTrade(
                trade,
                {
                    entryOrder: { data: { order: { orderId: 'pending' } } } as BingXOrderResponse,
                    stopOrder: { data: { order: { orderId: 'pending' } } } as BingXOrderResponse,
                    tpOrders: []
                },
                quantity,
                leverageInfo.optimalLeverage
            );

            // Place entry order (MARKET)
            const entryOrder = await this.placeOrder(
                trade.symbol,
                trade.type === 'LONG' ? 'BUY' : 'SELL',
                trade.type,
                'MARKET',
                0, // No price for MARKET orders
                0,
                quantity,
                tradeRecord.id
            );

            // Place stop loss order (LIMIT)
            const stopOrder = await this.placeOrder(
                trade.symbol,
                trade.type === 'LONG' ? 'SELL' : 'BUY',
                trade.type,
                'STOP',
                trade.stop,
                trade.stop,
                quantity,
                tradeRecord.id
            );

            // Place take profit orders based on the scenario
            const tpOrders = await this.placeTakeProfitOrders(trade, quantity, tradeRecord.id);

            // Update trade record with actual order IDs
            await this.tradeDatabase.updateOrderIds(tradeRecord.id, {
                entryOrderId: entryOrder.data.order.orderId,
                stopOrderId: stopOrder.data.order.orderId,
                tp1OrderId: tpOrders[0]?.data.order.orderId || null,
                tp2OrderId: tpOrders[1]?.data.order.orderId || null,
                tp3OrderId: tpOrders[2]?.data.order.orderId || null,
                tp4OrderId: tpOrders[3]?.data.order.orderId || null,
                tp5OrderId: tpOrders[4]?.data.order.orderId || null,
                tp6OrderId: tpOrders[5]?.data.order.orderId || null,
                trailingStopOrderId: tpOrders[6]?.data.order.orderId || null
            });

            // Get updated trade record
            const updatedTradeRecord = await this.tradeDatabase.getTradeById(tradeRecord.id);

            return {
                entryOrder,
                stopOrder,
                tpOrders,
                leverage: leverageInfo,
                quantity,
                tradeRecord: updatedTradeRecord
            };
        } catch (error) {
            console.error('Error executing trade:', error);
            throw error;
        }
    }

    public async cancelOrder(pair: string, orderId: string): Promise<void> {
        const path = '/openApi/swap/v2/trade/cancelOrder';
        const params = {
            symbol: pair,
            orderId: orderId
        };

        try {
            await this.apiClient.post(path, params);
        } catch (error) {
            console.error('Error canceling order:', error);
            throw error;
        }
    }
} 