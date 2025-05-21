import axios from 'axios';
import crypto from 'crypto';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export interface Order {
    orderId: string;
    symbol: string;
    side: 'BUY' | 'SELL';
    positionSide: 'LONG' | 'SHORT';
    type: 'LIMIT' | 'MARKET' | 'STOP' | 'STOP_MARKET' | 'TAKE_PROFIT' | 'TAKE_PROFIT_MARKET';
    price: string;
    stopPrice: string;
    quantity: string;
    status: 'NEW' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELED' | 'REJECTED' | 'EXPIRED';
    clientOrderId: string;
    createTime: number;
    updateTime: number;
}

interface BingXOrderResponse {
    code: number;
    msg: string;
    data: Order[];
}

export class OrderMonitor {
    private readonly apiKey: string;
    private readonly apiSecret: string;
    private readonly baseUrl: string;
    private openOrders: Map<string, Order> = new Map();

    constructor() {
        this.apiKey = process.env.BINGX_API_KEY || '';
        this.apiSecret = process.env.BINGX_API_SECRET || '';
        this.baseUrl = process.env.BINGX_BASE_URL || 'https://open-api.bingx.com';

        if (!this.apiKey || !this.apiSecret) {
            throw new Error('BINGX_API_KEY and BINGX_API_SECRET must be set in .env file');
        }
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

    private getOrderKey(order: Order): string {
        return `${order.orderId}_${order.symbol}_${order.positionSide}`;
    }

    public async updateOpenOrders(): Promise<void> {
        try {
            const timestamp = Date.now();
            const path = '/openApi/swap/v2/user/openOrders';
            const params = {
                timestamp: timestamp.toString()
            };

            const signature = this.generateSignature(timestamp, 'GET', path, params);

            const response = await axios.get(`${this.baseUrl}${path}`, {
                params,
                headers: {
                    'X-BX-APIKEY': this.apiKey,
                    'X-BX-SIGN': signature,
                    'X-BX-TIMESTAMP': timestamp.toString()
                }
            });

            const data = response.data as BingXOrderResponse;
            
            // Clear existing orders
            this.openOrders.clear();

            // Update with new orders
            for (const order of data.data) {
                if (order.status === 'NEW' || order.status === 'PARTIALLY_FILLED') {
                    this.openOrders.set(this.getOrderKey(order), order);
                }
            }
        } catch (error) {
            console.error('Error fetching open orders:', error);
            throw error;
        }
    }

    public getStopMarketOrder(symbol: string, positionSide: 'LONG' | 'SHORT'): Order | undefined {
        for (const order of this.openOrders.values()) {
            if (
                order.symbol === symbol &&
                order.positionSide === positionSide &&
                order.type === 'STOP_MARKET' &&
                (order.status === 'NEW' || order.status === 'PARTIALLY_FILLED')
            ) {
                return order;
            }
        }
        return undefined;
    }

    public getAllOpenOrders(): Order[] {
        return Array.from(this.openOrders.values());
    }

    public getOpenOrdersBySymbol(symbol: string): Order[] {
        return Array.from(this.openOrders.values())
            .filter(order => order.symbol === symbol);
    }

    public getOpenOrdersByPositionSide(symbol: string, positionSide: 'LONG' | 'SHORT'): Order[] {
        return Array.from(this.openOrders.values())
            .filter(order => 
                order.symbol === symbol && 
                order.positionSide === positionSide
            );
    }

    public hasOpenStopMarketOrder(symbol: string, positionSide: 'LONG' | 'SHORT'): boolean {
        return this.getStopMarketOrder(symbol, positionSide) !== undefined;
    }

    public getOrderById(orderId: string): Order | undefined {
        for (const order of this.openOrders.values()) {
            if (order.orderId === orderId) {
                return order;
            }
        }
        return undefined;
    }
} 