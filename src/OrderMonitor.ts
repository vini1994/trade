import { BingXApiClient } from './services/BingXApiClient';
import * as dotenv from 'dotenv';
import { BingXOrderExecutor } from './BingXOrderExecutor';
import { MonitoredPosition } from './utils/types';

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

export interface Orders {
    orders: Order[]
}

interface BingXOrderResponse {
    code: number;
    msg: string;
    data: Orders;
}

export class OrderMonitor {
    private readonly apiClient: BingXApiClient;
    private openOrders: Map<string, Order> = new Map();
    private readonly orderExecutor: BingXOrderExecutor;

    constructor() {
        this.apiClient = new BingXApiClient();
        this.orderExecutor = new BingXOrderExecutor();
    }

    private getOrderKey(order: Order): string {
        return `${order.orderId}_${order.symbol}_${order.positionSide}`;
    }

    public async updateOpenOrders(): Promise<void> {
        try {
            const path = '/openApi/swap/v2/trade/openOrders';
            const params = {
                timestamp: Date.now().toString()
            };

            const data = await this.apiClient.get<BingXOrderResponse>(path, params);
            
            // Clear existing orders
            this.openOrders.clear();

            // Update with new orders
            for (const order of data.data.orders) {
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
                (order.type === 'STOP_MARKET' || order.type === 'STOP') &&
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

    private async cancelOrder(order: Order): Promise<void> {
        try {
            await this.orderExecutor.cancelOrder(order.symbol, order.orderId);
            console.log(`Cancelled order ${order.orderId} for ${order.symbol} ${order.positionSide}`);
        } catch (error) {
            console.error(`Error cancelling order ${order.orderId}:`, error);
            throw error;
        }
    }

    public async cancelOrphanedOrders(monitoredPositions: Map<string, MonitoredPosition>): Promise<void> {
        try {
            // Update open orders first to get latest state
            await this.updateOpenOrders();

            // For each open order, check if there's a corresponding monitored position
            for (const order of this.openOrders.values()) {
                const positionKey = `${order.symbol}_${order.positionSide}`;
                const hasPosition = monitoredPositions.has(positionKey);

                // If no position exists for this order, cancel it
                if (!hasPosition) {
                    console.log(`Found orphaned order for ${order.symbol} ${order.positionSide} (${order.type})`);
                    await this.cancelOrder(order);
                }
            }
        } catch (error) {
            console.error('Error cancelling orphaned orders:', error);
            throw error;
        }
    }
} 