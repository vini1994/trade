import axios from 'axios';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import * as path from 'path';
import { KlineData, AllowedInterval } from './utils/types';

interface CacheKey {
    symbol: string;
    interval: AllowedInterval;
    hour: number;
    minutes: number;
    day: number;
    month: number;
    year: number;
}

export class BinanceFuturesDataService {
    private readonly baseUrl: string = 'https://fapi.binance.com/fapi/v1';
    private db: any;
    private readonly validIntervals: AllowedInterval[] = ['5m', '15m', '1h'];

    constructor() {
        this.initializeDatabase();
    }

    private async initializeDatabase() {
        const dbPath = path.join(__dirname, '../db/binance_futures_cache.db');
        this.db = await open({
            filename: dbPath,
            driver: sqlite3.Database
        });

        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS futures_kline_cache (
                symbol TEXT,
                interval TEXT,
                hour INTEGER,
                minutes INTEGER,
                day INTEGER,
                month INTEGER,
                year INTEGER,
                data TEXT,
                timestamp INTEGER,
                PRIMARY KEY (symbol, interval, hour, minutes, day, month, year)
            )
        `);
    }

    private getCurrentTimeComponents(interval: AllowedInterval): CacheKey {
        const now = new Date();
        const minutes = now.getMinutes();
        
        let cacheMinutes = 0;
        if (interval === '5m') {
            cacheMinutes = Math.floor(minutes / 5) * 5;
        } else if (interval === '15m') {
            cacheMinutes = Math.floor(minutes / 15) * 15;
        }
        // For 1h interval, minutes will remain 0

        return {
            symbol: '', // This will be set when calling getCachedData
            interval,
            hour: now.getHours(),
            minutes: cacheMinutes,
            day: now.getDate(),
            month: now.getMonth() + 1, // getMonth() returns 0-11
            year: now.getFullYear()
        };
    }

    private async getCachedData(symbol: string, timeComponents: CacheKey): Promise<KlineData[] | null> {
        const result = await this.db.get(
            'SELECT data FROM futures_kline_cache WHERE symbol = ? AND interval = ? AND hour = ? AND minutes = ? AND day = ? AND month = ? AND year = ?',
            [symbol, timeComponents.interval, timeComponents.hour, timeComponents.minutes, timeComponents.day, timeComponents.month, timeComponents.year]
        );

        if (result) {
            return JSON.parse(result.data);
        }
        return null;
    }

    private async cacheData(symbol: string, timeComponents: CacheKey, data: KlineData[]): Promise<void> {
        await this.db.run(
            'INSERT OR REPLACE INTO futures_kline_cache (symbol, interval, hour, minutes, day, month, year, data, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [symbol, timeComponents.interval, timeComponents.hour, timeComponents.minutes, timeComponents.day, timeComponents.month, timeComponents.year, JSON.stringify(data), Date.now()]
        );
    }

    private parseKlineData(kline: any[]): KlineData {
        return {
            openTime: kline[0],
            open: kline[1],
            high: kline[2],
            low: kline[3],
            close: kline[4],
            volume: kline[5],
            closeTime: kline[6],
            quoteAssetVolume: kline[7],
            numberOfTrades: kline[8],
            takerBuyBaseAssetVolume: kline[9],
            takerBuyQuoteAssetVolume: kline[10]
        };
    }

    public async getKlineData(symbol: string, interval: AllowedInterval = '1h'): Promise<KlineData[]> {
        if (!this.validIntervals.includes(interval)) {
            throw new Error(`Invalid interval. Must be one of: ${this.validIntervals.join(', ')}`);
        }

        const timeComponents = this.getCurrentTimeComponents(interval);
        timeComponents.symbol = symbol;
        
        // Check cache first
        const cachedData = await this.getCachedData(symbol, timeComponents);
        if (cachedData) {
            console.log(`Returning cached futures data for ${symbol} (${interval}) at ${timeComponents.hour}:${timeComponents.minutes} on ${timeComponents.day}/${timeComponents.month}/${timeComponents.year}`);
            return cachedData;
        }

        try {
            const response = await axios.get(`${this.baseUrl}/continuousKlines`, {
                params: {
                    pair: symbol,
                    contractType: 'PERPETUAL',
                    interval: interval,
                    limit: 56
                }
            });

            const klineData = response.data.map(this.parseKlineData);
            
            // Cache the data
            await this.cacheData(symbol, timeComponents, klineData);
            
            console.log(`Fetched and cached new futures data for ${symbol} (${interval}) at ${timeComponents.hour}:${timeComponents.minutes} on ${timeComponents.day}/${timeComponents.month}/${timeComponents.year}`);
            return klineData;
        } catch (error) {
            console.error(`Error fetching futures data for ${symbol} (${interval}):`, error);
            throw error;
        }
    }
} 