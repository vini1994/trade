import axios from 'axios';

interface TradeNotification {
    symbol: string;
    type: 'LONG' | 'SHORT';
    entry: number;
    stop: number;
    takeProfits: {
        tp1: number | null;
        tp2: number | null;
        tp3: number | null;
        tp4: number | null;
        tp5: number | null;
        tp6: number | null;
    };
    validation: {
        isValid: boolean;
        message: string;
        volumeAnalysis: {
            color: string;
            stdBar: number;
            currentVolume: number;
            mean: number;
            std: number;
        };
        entryAnalysis: {
            currentClose: number;
            canEnter: boolean;
            hasClosePriceBeforeEntry: boolean;
            message: string;
        };
    };
    analysisUrl: string;
    executionResult?: {
        leverage: number;
        quantity: number;
        entryOrderId: string;
        stopOrderId: string;
        volumeMarginAdded?: {
            percentage: number;
            baseMargin: number;
            totalMargin: number;
        };
    };
    executionError?: string;
    timestamp: string;
    isWarning?: boolean;
    volume_required: boolean;
    volume_adds_margin: boolean;
    setup_description: string | null;
}

export class NotificationService {
    private readonly apiUrl: string;

    constructor(apiUrl: string = process.env.NOTIFICATION_API_URL || 'http://localhost:3000/api/notification') {
        this.apiUrl = apiUrl;
    }

    public async sendTradeNotification(trade: Omit<TradeNotification, 'timestamp'>): Promise<void> {
        try {
            const notificationWithTimestamp = {
                ...trade,
                timestamp: new Date().toISOString()
            };
            const response = await axios.post(this.apiUrl, notificationWithTimestamp);
            console.log('Trade notification sent successfully:', response.status);
        } catch (error) {
            console.error('Error sending trade notification:', error);
            throw error;
        }
    }
} 