import axios from 'axios';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import * as path from 'path';
import { KlineData } from './utils/types';


interface CacheKey {
    symbol: string;
    hour: number;
    day: number;
    month: number;
    year: number;
}

export class BinanceDataService {
    private readonly baseUrl: string = 'https://api.binance.com/api/v3';
    private db: any;

    constructor() {
        this.initializeDatabase();
    }

    private async initializeDatabase() {
        const dbPath = path.join(__dirname, '../data/binance_cache.db');
        this.db = await open({
            filename: dbPath,
            driver: sqlite3.Database
        });

        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS kline_cache (
                symbol TEXT,
                hour INTEGER,
                day INTEGER,
                month INTEGER,
                year INTEGER,
                data TEXT,
                timestamp INTEGER,
                PRIMARY KEY (symbol, hour, day, month, year)
            )
        `);
    }

    private getCurrentTimeComponents(): CacheKey {
        const now = new Date();
        return {
            symbol: '', // This will be set when calling getCachedData
            hour: now.getHours(),
            day: now.getDate(),
            month: now.getMonth() + 1, // getMonth() returns 0-11
            year: now.getFullYear()
        };
    }

    private async getCachedData(symbol: string, timeComponents: CacheKey): Promise<KlineData[] | null> {
        const result = await this.db.get(
            'SELECT data FROM kline_cache WHERE symbol = ? AND hour = ? AND day = ? AND month = ? AND year = ?',
            [symbol, timeComponents.hour, timeComponents.day, timeComponents.month, timeComponents.year]
        );

        if (result) {
            return JSON.parse(result.data);
        }
        return null;
    }

    private async cacheData(symbol: string, timeComponents: CacheKey, data: KlineData[]): Promise<void> {
        await this.db.run(
            'INSERT OR REPLACE INTO kline_cache (symbol, hour, day, month, year, data, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [symbol, timeComponents.hour, timeComponents.day, timeComponents.month, timeComponents.year, JSON.stringify(data), Date.now()]
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

    public async getKlineData(symbol: string): Promise<KlineData[]> {
        const timeComponents = this.getCurrentTimeComponents();
        
        // Check cache first
        const cachedData = await this.getCachedData(symbol, timeComponents);
        if (cachedData) {
            console.log(`Returning cached data for ${symbol} at ${timeComponents.hour}:00 on ${timeComponents.day}/${timeComponents.month}/${timeComponents.year}`);
            return cachedData;
        }

        try {
            const response = await axios.get(`${this.baseUrl}/klines`, {
                params: {
                    symbol: symbol,
                    interval: '1h',
                    limit: 56
                }
            });

            const klineData = response.data.map(this.parseKlineData);
            
            // Cache the data
            await this.cacheData(symbol, timeComponents, klineData);
            
            console.log(`Fetched and cached new data for ${symbol} at ${timeComponents.hour}:00 on ${timeComponents.day}/${timeComponents.month}/${timeComponents.year}`);
            return klineData;
        } catch (error) {
            console.error(`Error fetching data for ${symbol}:`, error);
            throw error;
        }
    }
} 