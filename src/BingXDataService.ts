import { BingXApiClient } from './services/BingXApiClient';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import * as path from 'path';
import crypto from 'crypto';
import * as dotenv from 'dotenv';
import { KlineData } from './utils/types';

// Load environment variables
dotenv.config();


interface CacheKey {
    symbol: string;
    hour: number;
    day: number;
    month: number;
    year: number;
}

export class BingXDataService {
    private readonly apiClient: BingXApiClient;
    private db: any;

    constructor() {
        // Initialize without any config since we're using environment variables
        this.apiClient = new BingXApiClient();
        this.initializeDatabase();
    }

    private async initializeDatabase() {
        const dbPath = path.join(__dirname, '../db/bingx_cache.db');
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

    private parseKlineData(kline: any): KlineData {
        return {
            openTime: kline.time,
            open: kline.open,
            high: kline.high,
            low: kline.low,
            close: kline.close,
            volume: kline.volume,
            closeTime: kline.time,
            quoteAssetVolume: "0",
            numberOfTrades: 0,
            takerBuyBaseAssetVolume: "0",
            takerBuyQuoteAssetVolume: "0"
        
        };
    }

    private normalizeSymbol(symbol: string): string {
        const upperSymbol = symbol.toUpperCase();
        if (!upperSymbol.endsWith('-USDT')) {
            return upperSymbol.replace('USDT', '') + '-USDT';
        }
        return upperSymbol;
    }

    public async getKlineData(symbol: string): Promise<KlineData[]> {
        const normalizedSymbol = this.normalizeSymbol(symbol);
        const timeComponents = this.getCurrentTimeComponents();
        
        // Check cache first
        const cachedData = await this.getCachedData(normalizedSymbol, timeComponents);
        if (cachedData) {
            console.log(`Returning cached data for ${normalizedSymbol} at ${timeComponents.hour}:00 on ${timeComponents.day}/${timeComponents.month}/${timeComponents.year}`);
            return cachedData;
        }

        try {
            const path = '/openApi/swap/v3/quote/klines';
            const params = {
                symbol: normalizedSymbol,
                interval: '1h',
                limit: 56,
                timestamp: Date.now().toString()
            };

            const response = await this.apiClient.get<{ data: any[] }>(path, params);
            const klineData = response.data.map(this.parseKlineData);
            
            // Cache the data
            await this.cacheData(normalizedSymbol, timeComponents, klineData);
            
            console.log(`Fetched and cached new data for ${normalizedSymbol} at ${timeComponents.hour}:00 on ${timeComponents.day}/${timeComponents.month}/${timeComponents.year}`);
            return klineData;
        } catch (error) {
            console.error(`Error fetching data for ${normalizedSymbol}:`, error);
            throw error;
        }
    }

    public async getSymbolPrice(symbol: string): Promise<number> {
        const normalizedSymbol = this.normalizeSymbol(symbol);
        try {
            const path = '/openApi/swap/v2/quote/ticker';
            const params = {
                symbol: normalizedSymbol,
                timestamp: Date.now().toString()
            };

            const response = await this.apiClient.get<{ data: { lastPrice: string } }>(path, params);
            return parseFloat(response.data.lastPrice);
        } catch (error) {
            console.error(`Error fetching price for ${normalizedSymbol}:`, error);
            throw error;
        }
    }

    public async getSymbolInfo(symbol: string): Promise<{
        maxLeverage: number;
        minLeverage: number;
        maxPositionValue: number;
        minPositionValue: number;
    }> {
        const normalizedSymbol = this.normalizeSymbol(symbol);
        try {
            const path = '/openApi/swap/v2/quote/contract';
            const params = {
                symbol: normalizedSymbol,
                timestamp: Date.now().toString()
            };

            const response = await this.apiClient.get<{ data: {
                maxLeverage: number;
                minLeverage: number;
                maxPositionValue: number;
                minPositionValue: number;
            } }>(path, params);

            return response.data;
        } catch (error) {
            console.error(`Error fetching symbol info for ${normalizedSymbol}:`, error);
            throw error;
        }
    }
} 