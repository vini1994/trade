import { BingXApiClient } from './services/BingXApiClient';
import { normalizeSymbolBingX } from './utils/bingxUtils';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface BingXPairInfo {
    data: {
        maxLongLeverage: number;
        maxShortLeverage: number;
        longLeverage: number;
        shortLeverage: number;
    };
}

export class LeverageCalculator {
    private readonly apiClient: BingXApiClient;
    private readonly maxRiskPerTrade: number;
    private readonly maxLeverage: number;

    constructor() {
        this.apiClient = new BingXApiClient();
        this.maxRiskPerTrade = Number(process.env.MAX_RISK_PER_TRADE) || 1; // Default to 1% risk per trade
        this.maxLeverage = Number(process.env.MAX_LEVERAGE) || 20; // Default to 20x max leverage
    }

    private async getPairInfo(pair: string): Promise<BingXPairInfo> {
        const normalizedPair = normalizeSymbolBingX(pair);
        const path = '/openApi/swap/v2/quote/contracts';
        const params = {
            symbol: normalizedPair
        };

        try {
            const response = await this.apiClient.get<BingXPairInfo>(path, params);
            return response;
        } catch (error) {
            console.error('Error fetching pair info:', error);
            throw error;
        }
    }

    public async calculateOptimalLeverage(pair: string, entry: number, stop: number, side: 'LONG' | 'SHORT'): Promise<{
        optimalLeverage: number;
        theoreticalMaxLeverage: number;
        theoreticalRealMaxLeverage: number;
        exchangeMaxLeverage: number;
        stopLossPercentage: number;
    }> {
        try {
            // Get pair info to get max leverage
            const pairInfo = await this.getPairInfo(pair);
            const exchangeMaxLeverage = Math.floor(side === 'LONG' ? pairInfo.data.maxLongLeverage : pairInfo.data.maxShortLeverage);

            // Calculate stop loss percentage
            const stopLossPercentage = side === 'LONG' 
                ? ((entry - stop) / entry)  
                : ((stop - entry) / entry);

            // Calculate theoretical max leverage based on risk
            const theoreticalMaxLeverage = 1/(this.maxRiskPerTrade / stopLossPercentage);

            const theoreticalRealMaxLeverage = theoreticalMaxLeverage - (theoreticalMaxLeverage*0.2);

            // Use the minimum between theoretical max leverage, exchange max leverage, and configured max leverage
            const optimalLeverage = Math.min(
                Math.floor(theoreticalRealMaxLeverage),
                exchangeMaxLeverage,
                this.maxLeverage
            );

            return {
                optimalLeverage,
                theoreticalMaxLeverage,
                theoreticalRealMaxLeverage,
                exchangeMaxLeverage,
                stopLossPercentage
            };
        } catch (error) {
            console.error('Error calculating optimal leverage:', error);
            throw error;
        }
    }

    private async getCurrentLeverage(pair: string, side: 'LONG' | 'SHORT'): Promise<number> {
        const pairInfo = await this.getPairInfo(pair);
        return side === 'LONG' ? pairInfo.data.longLeverage : pairInfo.data.shortLeverage;
    }

    public async setLeverage(pair: string, leverage: number, positionSide: 'LONG' | 'SHORT'): Promise<void> {
        const normalizedPair = normalizeSymbolBingX(pair);
        const path = '/openApi/swap/v2/trade/leverage';
        const params = {
            symbol: normalizedPair,
            leverage: leverage.toString(),
            positionSide: positionSide
        };

        try {
            await this.apiClient.post(path, params);
            console.log(`Set leverage to ${leverage}x for ${normalizedPair} ${positionSide}`);
        } catch (error) {
            console.error('Error setting leverage:', error);
            throw error;
        }
    }
} 