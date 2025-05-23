import axios from 'axios';

interface TradeNotification {
    symbol: string;
    type: 'LONG' | 'SHORT';
    entry: number;
    stop: number;
    takeProfits: {
        tp1: number;
        tp2: number;
        tp3: number;
    };
    validation: {
        isValid: boolean;
        message: string;
        volumeAnalysis: {
            color: string;
            stdBar: number;
        };
        entryAnalysis: {
            currentClose: number;
        };
    };
    analysisUrl: string;
    executionResult?: {
        leverage: number;
        quantity: number;
        entryOrderId: string;
        stopOrderId: string;
    };
    executionError?: string;
}

export class NotificationService {
    private readonly apiUrl: string;

    constructor(apiUrl: string = process.env.NOTIFICATION_API_URL || 'http://localhost:3000/api/notification') {
        this.apiUrl = apiUrl;
    }

    public async sendTradeNotification(trade: TradeNotification): Promise<void> {
        try {
            const response = await axios.post(this.apiUrl, trade);
            console.log('Trade notification sent successfully:', response.status);
        } catch (error) {
            console.error('Error sending trade notification:', error);
            throw error;
        }
    }
} 