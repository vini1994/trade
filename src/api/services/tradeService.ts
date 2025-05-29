import fs from 'fs/promises';
import path from 'path';

const TRADES_FILE = path.join(__dirname, '../../../data/trades.json');

export interface Trade {
    entry: number;
    stop: number;
    side: 'LONG' | 'SHORT';
    tp1: number;
    tp2: number | null;
    tp3: number | null;
    tp4: number | null;
    tp5: number | null;
    tp6: number | null;
    pair: string;
    no_volume_invalidates_trade: boolean;
    volume_adds_margin: boolean;
    setup_description: string;
    url_analysis: string;
    volume_required: boolean;
}

export class TradeService {
    async readTrades(): Promise<Trade[]> {
        try {
            const data = await fs.readFile(TRADES_FILE, 'utf-8');
            return JSON.parse(data);
        } catch (error) {
            // If file doesn't exist, create it with an empty array
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                await this.writeTrades([]);
                return [];
            }
            throw error;
        }
    }

    async writeTrades(trades: Trade[]): Promise<void> {
        await fs.writeFile(TRADES_FILE, JSON.stringify(trades, null, 2));
    }

    async addTrade(trade: Trade): Promise<Trade> {
        const trades = await this.readTrades();
        trades.push(trade);
        await this.writeTrades(trades);
        return trade;
    }

    async updateTrade(index: number, trade: Partial<Trade>): Promise<Trade> {
        const trades = await this.readTrades();
        if (index < 0 || index >= trades.length) {
            throw new Error('Trade not found');
        }
        const updatedTrade = { ...trades[index], ...trade };
        trades[index] = updatedTrade;
        await this.writeTrades(trades);
        return updatedTrade;
    }

    async deleteTrade(index: number): Promise<Trade> {
        const trades = await this.readTrades();
        if (index < 0 || index >= trades.length) {
            throw new Error('Trade not found');
        }
        const deletedTrade = trades[index];
        trades.splice(index, 1);
        await this.writeTrades(trades);
        return deletedTrade;
    }

    async getTrade(index: number): Promise<Trade> {
        const trades = await this.readTrades();
        if (index < 0 || index >= trades.length) {
            throw new Error('Trade not found');
        }
        return trades[index];
    }
} 