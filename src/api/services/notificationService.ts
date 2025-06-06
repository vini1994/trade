import { TradeDatabase } from '../../TradeDatabase';
import { TradeNotification } from '../../utils/types';

export interface Notification {
    id: string;
    message: string;
    timestamp: string;
    type: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';
}

export class NotificationService {
    private tradeDatabase: TradeDatabase;

    constructor() {
        this.tradeDatabase = new TradeDatabase();
    }

    async getNotifications(limit?: number): Promise<TradeNotification[]> {
        const notifications = await this.tradeDatabase.getTradeNotifications();
        if (limit) {
            return notifications.slice(0, limit);
        }
        return notifications;
    }

    async handleMarketTrade(tradeNotification: TradeNotification): Promise<TradeNotification> {
        // Store the trade notification in the database
        await this.tradeDatabase.saveTradeNotification(tradeNotification);
        return tradeNotification;
    }

    async handleTpAdjustedMarketTrade(tradeNotification: TradeNotification): Promise<TradeNotification> {
        // Store the tp adjusted trade notification in the database
        await this.tradeDatabase.saveTradeNotification(tradeNotification);
        return tradeNotification;
    }
} 