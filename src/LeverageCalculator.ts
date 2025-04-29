import axios from 'axios';
import crypto from 'crypto';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface BingXSymbolInfo {
    code: number;
    msg: string;
    data: {
        symbol: string;
        maxLeverage: number;
        minLeverage: number;
        maxPositionValue: number;
        minPositionValue: number;
    };
}

export class LeverageCalculator {
    private readonly apiKey: string;
    private readonly apiSecret: string;
    private readonly baseUrl: string;
    private readonly safetyMargin: number = 0.7; // 30% safety margin

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

    private async getSymbolInfo(symbol: string): Promise<BingXSymbolInfo> {
        const timestamp = Date.now();
        const path = '/openApi/swap/v2/quote/contract';
        const params = {
            symbol: symbol,
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

            return response.data;
        } catch (error) {
            console.error('Error fetching symbol info:', error);
            throw error;
        }
    }

    private calculateTheoreticalMaxLeverage(entry: number, stop: number): number {
        // Calculate the percentage difference between entry and stop
        const stopLossPercentage = Math.abs((stop - entry) / entry);
        
        // Calculate the theoretical maximum leverage based on stop loss
        // We use 100% as the maximum loss we're willing to take
        return 1 / stopLossPercentage;
    }

    public async calculateOptimalLeverage(symbol: string, entry: number, stop: number): Promise<{
        optimalLeverage: number;
        theoreticalMaxLeverage: number;
        exchangeMaxLeverage: number;
        stopLossPercentage: number;
    }> {
        try {
            // Get symbol info to get max leverage
            const symbolInfo = await this.getSymbolInfo(symbol);
            const exchangeMaxLeverage = symbolInfo.data.maxLeverage;
            
            // Calculate theoretical max leverage
            const theoreticalMaxLeverage = this.calculateTheoreticalMaxLeverage(entry, stop);
            
            // Apply safety margin
            const safeMaxLeverage = theoreticalMaxLeverage * this.safetyMargin;
            
            // Calculate optimal leverage
            const optimalLeverage = Math.min(Math.floor(safeMaxLeverage), exchangeMaxLeverage);
            
            // Calculate stop loss percentage for reference
            const stopLossPercentage = Math.abs((stop - entry) / entry) * 100;

            return {
                optimalLeverage,
                theoreticalMaxLeverage,
                exchangeMaxLeverage,
                stopLossPercentage
            };
        } catch (error) {
            console.error('Error calculating optimal leverage:', error);
            throw error;
        }
    }

    public async setLeverage(symbol: string, leverage: number): Promise<void> {
        const timestamp = Date.now();
        const path = '/openApi/swap/v2/trade/leverage';
        const params = {
            symbol: symbol,
            leverage: leverage.toString(),
            timestamp: timestamp.toString()
        };

        const signature = this.generateSignature(timestamp, 'POST', path, params);

        try {
            await axios.post(`${this.baseUrl}${path}`, params, {
                headers: {
                    'X-BX-APIKEY': this.apiKey,
                    'X-BX-SIGN': signature,
                    'X-BX-TIMESTAMP': timestamp.toString()
                }
            });
        } catch (error) {
            console.error('Error setting leverage:', error);
            throw error;
        }
    }
} 