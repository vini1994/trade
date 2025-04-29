import axios from 'axios';
import crypto from 'crypto';
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
    private readonly apiKey: string;
    private readonly apiSecret: string;
    private readonly baseUrl: string;

    constructor() {
        // Load configuration from environment variables
        this.apiKey = process.env.BINGX_API_KEY || '';
        this.apiSecret = process.env.BINGX_API_SECRET || '';
        this.baseUrl = process.env.BINGX_BASE_URL || 'https://open-api.bingx.com';

        // Validate required environment variables
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

    public async getOrderStatus(orderId: string): Promise<OrderStatus> {
        const timestamp = Date.now();
        const path = '/openApi/swap/v2/trade/order';
        const params = {
            orderId: orderId,
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

            const data = response.data as BingXOrderStatusResponse;
            
            if (data.code !== 0) {
                throw new Error(`Error fetching order status: ${data.msg}`);
            }

            return data.data;
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
                    orderStatuses.set(orderId, null);
                }
            })
        );

        return orderStatuses;
    }
} 