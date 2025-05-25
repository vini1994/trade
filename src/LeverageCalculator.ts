import { BingXApiClient } from './services/BingXApiClient';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface BingXSymbolInfo {
    code: number;
    msg: string;
    data: {
        symbol: string;
        longLeverage: number;
        shortLeverage: number;
        maxLongLeverage: number;
        maxShortLeverage: number;
        availableLongVol: number;
        availableShortVol: number;
        availableLongVal: number;
        availableShortVal: number;
        maxPositionValue: number;
        minPositionValue: number;
    };
}

export class LeverageCalculator {
    private readonly apiClient: BingXApiClient;
    private readonly safetyMargin: number = 0.7; // 30% safety margin

    constructor() {
        this.apiClient = new BingXApiClient();
    }

    private async getSymbolInfo(symbol: string): Promise<BingXSymbolInfo> {
        const path = '/openApi/swap/v2/trade/leverage';
        const params = {
            symbol: symbol
        };

        try {
            const response = await this.apiClient.get<BingXSymbolInfo>(path, params);
            console.log(response);
            return response;
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
        return Math.floor(1 / stopLossPercentage); // Ensure integer leverage
    }

    public async calculateOptimalLeverage(symbol: string, entry: number, stop: number, side: 'LONG' | 'SHORT'): Promise<{
        optimalLeverage: number;
        theoreticalMaxLeverage: number;
        exchangeMaxLeverage: number;
        stopLossPercentage: number;
    }> {
        try {
            // Get symbol info to get max leverage
            const symbolInfo = await this.getSymbolInfo(symbol);
            const exchangeMaxLeverage = Math.floor(side === 'LONG' ? symbolInfo.data.maxLongLeverage : symbolInfo.data.maxShortLeverage);
            
            // Calculate theoretical max leverage
            const theoreticalMaxLeverage = this.calculateTheoreticalMaxLeverage(entry, stop);
            
            // Apply safety margin and ensure integer
            const safeMaxLeverage = Math.floor(theoreticalMaxLeverage * this.safetyMargin);
            
            // Calculate optimal leverage (already integer from Math.floor)
            const optimalLeverage = Math.min(safeMaxLeverage, exchangeMaxLeverage);
            
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

    private async getCurrentLeverage(symbol: string, side: 'LONG' | 'SHORT'): Promise<number> {
        const symbolInfo = await this.getSymbolInfo(symbol);
        return side === 'LONG' ? symbolInfo.data.longLeverage : symbolInfo.data.shortLeverage;
    }

    public async setLeverage(symbol: string, leverage: number, side: 'LONG' | 'SHORT'): Promise<boolean> {
        // Ensure leverage is an integer
        const targetLeverage = Math.floor(leverage);
        const currentLeverage = Math.floor(await this.getCurrentLeverage(symbol, side));
        
        // Since we're dealing with integers, we can use exact comparison
        if (currentLeverage !== targetLeverage) {
            const path = '/openApi/swap/v2/trade/leverage';
            const params = {
                symbol: symbol,
                leverage: targetLeverage.toString(),
                side: side
            };

            try {
                await this.apiClient.post(path, params);
                return true; // Leverage was changed
            } catch (error) {
                console.error('Error setting leverage:', error);
                throw error;
            }
        }
        
        return false; // Leverage was not changed
    }
} 