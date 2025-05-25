import { BingXApiClient } from './services/BingXApiClient';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface OrderStatus {
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
    executedQty: string;
    avgPrice: string;
    createTime: number;
    updateTime: number;
}

interface BingXOrderStatusResponse {
    code: number;
    msg: string;
    data: OrderStatus;
}

export class OrderStatusChecker {
    private readonly apiClient: BingXApiClient;

    constructor() {
        this.apiClient = new BingXApiClient();
    }

    public async getOrderStatus(orderId: string): Promise<OrderStatus> {
        const path = '/openApi/swap/v2/trade/order';
        const params = {
            orderId: orderId
        };

        try {
            const response = await this.apiClient.get<BingXOrderStatusResponse>(path, params);
            
            if (response.code !== 0) {
                throw new Error(`Error fetching order status: ${response.msg}`);
            }

            return response.data;
        } catch (error) {
            console.error('Error fetching order status:', error);
            throw error;
        }
    }

    public async getOrderStatusWithDetails(orderId: string): Promise<{
        status: OrderStatus;
        isFilled: boolean;
        isCanceled: boolean;
        isOpen: boolean;
        executionDetails: {
            executedQuantity: number;
            averagePrice: number;
            createTime: Date;
            updateTime: Date;
        };
    }> {
        const orderStatus = await this.getOrderStatus(orderId);

        return {
            status: orderStatus,
            isFilled: orderStatus.status === 'FILLED',
            isCanceled: orderStatus.status === 'CANCELED',
            isOpen: orderStatus.status === 'NEW' || orderStatus.status === 'PARTIALLY_FILLED',
            executionDetails: {
                executedQuantity: parseFloat(orderStatus.executedQty),
                averagePrice: parseFloat(orderStatus.avgPrice),
                createTime: new Date(orderStatus.createTime),
                updateTime: new Date(orderStatus.updateTime)
            }
        };
    }

    public async getMultipleOrderStatus(orderIds: string[]): Promise<Map<string, OrderStatus>> {
        const orderStatuses = new Map<string, OrderStatus>();
        
        await Promise.all(
            orderIds.map(async (orderId) => {
                try {
                    const status = await this.getOrderStatus(orderId);
                    orderStatuses.set(orderId, status);
                } catch (error) {
                    console.error(`Error fetching status for order ${orderId}:`, error);
                    //orderStatuses.set(orderId, null);
                }
            })
        );

        return orderStatuses;
    }
} 