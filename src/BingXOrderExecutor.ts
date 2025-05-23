import axios from 'axios';
import crypto from 'crypto';
import { LeverageCalculator } from './LeverageCalculator';
import { PositionValidator } from './PositionValidator';
import { TradeDatabase } from './TradeDatabase';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface Trade {
    symbol: string;
    type: 'LONG' | 'SHORT';
    entry: number;
    stop: number;
    tp1: number;
    tp2: number;
    tp3: number;
}

interface BingXOrderResponse {
    code: number;
    msg: string;
    data: {
        orderId: string;
        clientOrderId: string;
        symbol: string;
        side: string;
        positionSide: string;
        type: string;
        price: string;
        stopPrice: string;
        quantity: string;
        status: string;
    };
}



export class BingXOrderExecutor {
    private readonly apiKey: string;
    private readonly apiSecret: string;
    private readonly baseUrl: string;
    private readonly leverageCalculator: LeverageCalculator;
    private readonly positionValidator: PositionValidator;
    private readonly tradeDatabase: TradeDatabase;
    private readonly margin: number;

    constructor() {
        // Load configuration from environment variables
        this.apiKey = process.env.BINGX_API_KEY || '';
        this.apiSecret = process.env.BINGX_API_SECRET || '';
        this.baseUrl = process.env.BINGX_BASE_URL || 'https://open-api.bingx.com';
        this.margin = parseFloat(process.env.BINGX_MARGIN || '100');

        // Validate required environment variables
        if (!this.apiKey || !this.apiSecret) {
            throw new Error('BINGX_API_KEY and BINGX_API_SECRET must be set in .env file');
        }

        this.leverageCalculator = new LeverageCalculator();
        this.positionValidator = new PositionValidator();
        this.tradeDatabase = new TradeDatabase();
    }

    private generateSignature(timestamp: number, method: string, path: string, params: any): string {
        const queryString = Object.entries(params)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => `${key}=${value}`)
            .join('&');

        const signatureString = `${timestamp}${method}${path}${queryString}`;
        return crypto
            .createHmac('sha256', this.apiSecret)
            .update(signatureString)
            .digest('hex');
    }

    private async getSymbolPrice(symbol: string): Promise<number> {
        const timestamp = Date.now();
        const path = '/openApi/swap/v2/quote/ticker';
        const params = {
            symbol: symbol,
            timestamp: timestamp.toString()
        };

        const signature = this.generateSignature(timestamp, 'GET', path, params);

        try {
            const response = await axios.get(`${this.baseUrl}${path}`, {
                params,
                headers: {
                    'X-BX-APIKEY': this.apiKey,
                    'X-BX-SIGN': signature,
                    'X-BX-TIMESTAMP': timestamp.toString()
                }
            });

            return parseFloat(response.data.data.lastPrice);
        } catch (error) {
            console.error('Error fetching symbol price:', error);
            throw error;
        }
    }

    private async calculatePositionQuantity(symbol: string, leverage: number): Promise<number> {
        try {
            // Get current price
            const currentPrice = await this.getSymbolPrice(symbol);
            
            // Calculate position value based on margin and leverage
            const positionValue = this.margin * leverage;
            
            // Calculate quantity based on position value and current price
            const quantity = positionValue / currentPrice;
            
            // Round to appropriate decimal places (usually 3 for most pairs)
            return Math.floor(quantity * 1000) / 1000;
        } catch (error) {
            console.error('Error calculating position quantity:', error);
            throw error;
        }
    }

    private async placeOrder(
        symbol: string,
        side: 'BUY' | 'SELL',
        positionSide: 'LONG' | 'SHORT',
        type: 'MARKET' | 'LIMIT' | 'STOP_MARKET' | 'TRIGGER_LIMIT',
        price: number,
        stopPrice: number,
        quantity: number
    ): Promise<BingXOrderResponse> {
        const timestamp = Date.now();
        const path = '/openApi/swap/v2/trade/order';
        const params: any = {
            symbol: symbol,
            side: side,
            positionSide: positionSide,
            type: type,
            price: type === 'MARKET' || type === 'STOP_MARKET' ? '' : price.toString(),
            stopPrice: stopPrice.toString(),
            quantity: quantity.toString(),
            timestamp: timestamp.toString()
        };

        // Add activationPrice for TRIGGER_LIMIT orders
        if (type === 'TRIGGER_LIMIT') {
            params.activationPrice = price.toString();
        }

        const signature = this.generateSignature(timestamp, 'POST', path, params);

        try {
            const response = await axios.post(`${this.baseUrl}${path}`, params, {
                headers: {
                    'X-BX-APIKEY': this.apiKey,
                    'X-BX-SIGN': signature,
                    'X-BX-TIMESTAMP': timestamp.toString()
                }
            });

            return response.data;
        } catch (error) {
            console.error('Error placing order:', error);
            throw error;
        }
    }

    private async placeTrailingStopOrder(
        symbol: string,
        side: 'BUY' | 'SELL',
        positionSide: 'LONG' | 'SHORT',
        quantity: number,
        activationPrice: number
    ): Promise<BingXOrderResponse> {
        const timestamp = Date.now();
        const path = '/openApi/swap/v2/trade/order';
        const params: any = {
            symbol: symbol,
            side: side,
            positionSide: positionSide,
            type: 'TRAILING_STOP_MARKET',
            quantity: quantity.toString(),
            activationPrice: activationPrice.toString(),
            timestamp: timestamp.toString()
        };

        const signature = this.generateSignature(timestamp, 'POST', path, params);

        try {
            const response = await axios.post(`${this.baseUrl}${path}`, params, {
                headers: {
                    'X-BX-APIKEY': this.apiKey,
                    'X-BX-SIGN': signature,
                    'X-BX-TIMESTAMP': timestamp.toString()
                }
            });

            return response.data;
        } catch (error) {
            console.error('Error placing trailing stop order:', error);
            throw error;
        }
    }

    private async placeTakeProfitOrders(trade: Trade, quantity: number): Promise<BingXOrderResponse[]> {
        const tpOrders: BingXOrderResponse[] = [];

        // Check which take profits are set
        const hasTp1 = trade.tp1 > 0;
        const hasTp2 = trade.tp2 > 0;
        const hasTp3 = trade.tp3 > 0;

        if (hasTp1 && !hasTp2 && !hasTp3) {
            // Scenario 1: Only TP1 is set - 90% of position
            const tp1Quantity = quantity * 0.9;
            tpOrders.push(
                await this.placeOrder(
                    trade.symbol,
                    trade.type === 'LONG' ? 'SELL' : 'BUY',
                    trade.type,
                    'TRIGGER_LIMIT',
                    trade.tp1,
                    trade.tp1,
                    tp1Quantity
                )
            );

            // Add trailing stop for remaining 10%
            const remainingQuantity = quantity - tp1Quantity;
            if (remainingQuantity > 0) {
                tpOrders.push(
                    await this.placeTrailingStopOrder(
                        trade.symbol,
                        trade.type === 'LONG' ? 'SELL' : 'BUY',
                        trade.type,
                        remainingQuantity,
                        trade.tp1 // Use TP1 as activation price
                    )
                );
            }
        } else if (hasTp1 && hasTp2 && !hasTp3) {
            // Scenario 2: TP1 and TP2 are set
            // TP1: 50% of total position
            const tp1Quantity = quantity * 0.5;
            tpOrders.push(
                await this.placeOrder(
                    trade.symbol,
                    trade.type === 'LONG' ? 'SELL' : 'BUY',
                    trade.type,
                    'TRIGGER_LIMIT',
                    trade.tp1,
                    trade.tp1,
                    tp1Quantity
                )
            );

            // TP2: 90% of remaining position (after TP1)
            const remainingAfterTp1 = quantity - tp1Quantity;
            const tp2Quantity = remainingAfterTp1 * 0.9;
            tpOrders.push(
                await this.placeOrder(
                    trade.symbol,
                    trade.type === 'LONG' ? 'SELL' : 'BUY',
                    trade.type,
                    'TRIGGER_LIMIT',
                    trade.tp2,
                    trade.tp2,
                    tp2Quantity
                )
            );

            // Add trailing stop for remaining quantity
            const remainingQuantity = remainingAfterTp1 - tp2Quantity;
            if (remainingQuantity > 0) {
                tpOrders.push(
                    await this.placeTrailingStopOrder(
                        trade.symbol,
                        trade.type === 'LONG' ? 'SELL' : 'BUY',
                        trade.type,
                        remainingQuantity,
                        trade.tp2 // Use TP2 as activation price
                    )
                );
            }
        } else if (hasTp1 && hasTp2 && hasTp3) {
            // Scenario 3: All TPs are set
            // TP1: 50% of total position
            const tp1Quantity = quantity * 0.5;
            tpOrders.push(
                await this.placeOrder(
                    trade.symbol,
                    trade.type === 'LONG' ? 'SELL' : 'BUY',
                    trade.type,
                    'TRIGGER_LIMIT',
                    trade.tp1,
                    trade.tp1,
                    tp1Quantity
                )
            );

            // TP2: 70% of remaining position (after TP1)
            const remainingAfterTp1 = quantity - tp1Quantity;
            const tp2Quantity = remainingAfterTp1 * 0.7;
            tpOrders.push(
                await this.placeOrder(
                    trade.symbol,
                    trade.type === 'LONG' ? 'SELL' : 'BUY',
                    trade.type,
                    'TRIGGER_LIMIT',
                    trade.tp2,
                    trade.tp2,
                    tp2Quantity
                )
            );

            // TP3: 90% of remaining position (after TP1 and TP2)
            const remainingAfterTp2 = remainingAfterTp1 - tp2Quantity;
            const tp3Quantity = remainingAfterTp2 * 0.9;
            tpOrders.push(
                await this.placeOrder(
                    trade.symbol,
                    trade.type === 'LONG' ? 'SELL' : 'BUY',
                    trade.type,
                    'TRIGGER_LIMIT',
                    trade.tp3,
                    trade.tp3,
                    tp3Quantity
                )
            );

            // Add trailing stop for remaining quantity
            const remainingQuantity = remainingAfterTp2 - tp3Quantity;
            if (remainingQuantity > 0) {
                tpOrders.push(
                    await this.placeTrailingStopOrder(
                        trade.symbol,
                        trade.type === 'LONG' ? 'SELL' : 'BUY',
                        trade.type,
                        remainingQuantity,
                        trade.tp3 // Use TP3 as activation price
                    )
                );
            }
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
        tradeRecord: any;
    }> {
        try {
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

            // Calculate position quantity based on margin and leverage
            const quantity = await this.calculatePositionQuantity(trade.symbol, leverageInfo.optimalLeverage);
            console.log(`Calculated position quantity: ${quantity} based on margin ${this.margin} USDT and leverage ${leverageInfo.optimalLeverage}x`);

            // Place entry order (MARKET)
            const entryOrder = await this.placeOrder(
                trade.symbol,
                trade.type === 'LONG' ? 'BUY' : 'SELL',
                trade.type,
                'MARKET',
                0, // No price for MARKET orders
                0,
                quantity
            );

            // Place stop loss order (LIMIT)
            const stopOrder = await this.placeOrder(
                trade.symbol,
                trade.type === 'LONG' ? 'SELL' : 'BUY',
                trade.type,
                'LIMIT',
                trade.stop,
                trade.stop,
                quantity
            );

            // Place take profit orders based on the scenario
            const tpOrders = await this.placeTakeProfitOrders(trade, quantity);

            // Save trade to database
            const tradeRecord = await this.tradeDatabase.saveTrade(
                trade,
                {
                    entryOrder,
                    stopOrder,
                    tpOrders
                },
                quantity,
                leverageInfo.optimalLeverage
            );

            return {
                entryOrder,
                stopOrder,
                tpOrders,
                leverage: leverageInfo,
                quantity,
                tradeRecord
            };
        } catch (error) {
            console.error('Error executing trade:', error);
            throw error;
        }
    }

    public async cancelOrder(symbol: string, orderId: string): Promise<void> {
        const timestamp = Date.now();
        const path = '/openApi/swap/v2/trade/cancelOrder';
        const params = {
            symbol: symbol,
            orderId: orderId,
            timestamp: timestamp.toString()
        };

        const signature = this.generateSignature(timestamp, 'POST', path, params);

        try {
            await axios.post(`${this.baseUrl}${path}`, params, {
                headers: {
                    'X-BX-APIKEY': this.apiKey,
                    'X-BX-SIGN': signature,
                    'X-BX-TIMESTAMP': timestamp.toString()
                }
            });
        } catch (error) {
            console.error('Error canceling order:', error);
            throw error;
        }
    }
} 