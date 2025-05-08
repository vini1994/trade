import { DataServiceManager } from './DataServiceManager';
import { KlineData } from './utils/types';

export type TradeType = 'LONG' | 'SHORT';

export class TradeEntryAnalyzer {
    private readonly dataServiceManager: DataServiceManager;

    constructor() {
        this.dataServiceManager = new DataServiceManager();
    }

    private isEntryConditionMet(currentClose: number, entry: number, type: TradeType): boolean {
        if (type === 'LONG') {
            return currentClose >= entry;
        } else {
            return currentClose <= entry;
        }
    }

    private hasPriceInRange(klineData: KlineData[], entry: number, stop: number, type: TradeType): boolean {
        // Sort by close time in descending order (most recent first)
        const sortedData = [...klineData].sort((a, b) => b.closeTime - a.closeTime);
        
        // Skip the most recent candle as we already checked it
        const dataToCheck = sortedData.slice(-1).reverse();

        for (const kline of dataToCheck) {
            const close = parseFloat(kline.close);
            
            // First check if this close meets entry condition
            if (this.isEntryConditionMet(close, entry, type)) {
                return false; // Found a close that meets entry condition, stop checking
            }
            
            if (type === 'LONG') {
                // For LONG, return true if any close is less than entry
                if (close < entry) {
                    return true;
                }
            } else {
                // For SHORT, return true if any close is greater than entry
                if (close > entry) {
                    return true;
                }
            }
        }

        return false;
    }

    public async analyzeEntry(symbol: string, type: TradeType, entry: number, stop: number): Promise<{
        canEnter: boolean;
        currentClose: number;
        hasPriceInRange: boolean;
        message: string;
    }> {
        try {
            // Get data from either Binance or BingX using DataServiceManager
            const { data: klineData, source } = await this.dataServiceManager.getKlineData(symbol);
            
            // Get the most recent close price
            const currentClose = parseFloat(klineData[klineData.length - 2].close);
            
            // Check if entry condition is met
            const entryConditionMet = this.isEntryConditionMet(currentClose, entry, type);
            
            // If entry condition is met, check for prices in range
            let hasPriceInRange = false;
            if (entryConditionMet) {
                hasPriceInRange = this.hasPriceInRange(klineData, entry, stop, type);
            }

            // Determine if we can enter the trade
            const canEnter = entryConditionMet && !hasPriceInRange;

            // Generate appropriate message
            let message = '';
            if (!entryConditionMet) {
                message = `Entry condition not met. Current close (${currentClose}) is not ${type === 'LONG' ? 'above' : 'below'} entry (${entry}) [${source}]`;
            } else if (hasPriceInRange) {
                message = `Entry condition met but price has been between stop (${stop}) and entry (${entry}) [${source}]`;
            } else {
                message = `Entry condition met and no price has been between stop (${stop}) and entry (${entry}) [${source}]`;
            }

            return {
                canEnter,
                currentClose,
                hasPriceInRange,
                message
            };
        } catch (error: any) {
            console.error(`Error analyzing entry for ${symbol}:`, error);
            throw new Error(`Failed to analyze entry for ${symbol}: ${error.message}`);
        }
    }
} 