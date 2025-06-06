import axios from 'axios';
import { TradeNotification } from './utils/types';
import { TradeDatabase } from './TradeDatabase';

export class NotificationService {
    private readonly apiUrl: string;
    private readonly tradeDatabase: TradeDatabase;

    constructor(apiUrl: string = process.env.NOTIFICATION_API_URL || 'http://localhost:3000/api/notification') {
        this.apiUrl = apiUrl;
        this.tradeDatabase = new TradeDatabase();
    }

    public async sendTradeNotification(trade: Omit<TradeNotification, 'timestamp'>): Promise<void> {
        try {
            const notificationWithTimestamp = {
                ...trade,
                timestamp: new Date().toISOString()
            };

            // Save notification to database
            await this.tradeDatabase.saveTradeNotification(notificationWithTimestamp);

            // Send notification to API
            const response = await axios.post(this.apiUrl, notificationWithTimestamp);
            console.log('Trade notification sent successfully:', response.status);
        } catch (error) {
            console.error('Error sending trade notification:', error);
            throw error;
        }
    }
} 