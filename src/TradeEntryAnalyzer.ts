import { DataServiceManager } from './DataServiceManager';
import { KlineData } from './utils/types';

export type TradeType = 'LONG' | 'SHORT';

export class TradeEntryAnalyzer {
    private readonly dataServiceManager: DataServiceManager;

    constructor() {
        this.dataServiceManager = new DataServiceManager();
    }

    private isEntryConditionMet(currentCandle: KlineData, entry: number, type: TradeType): boolean {
        if (type === 'LONG') {
            return parseFloat(currentCandle.close) > entry && parseFloat(currentCandle.low) <= entry;
        } else {
            return parseFloat(currentCandle.close) < entry && parseFloat(currentCandle.high) >= entry;
        }
    }

    private hasClosePriceBeforeEntry(klineData: KlineData[], entry: number, type: TradeType): boolean {
        // Sort by close time in descending order (most recent first)
        const sortedData = [...klineData].sort((a, b) => b.closeTime - a.closeTime);
        
        // Skip the most recent candle as we already checked it
        const dataToCheck = sortedData.slice(2)

        for (const kline of dataToCheck) {
            const close = parseFloat(kline.close);
            
            // First check if this close meets entry condition
            if (this.isEntryConditionMet(kline, entry, type)) {
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

    private isWickRatioValid(candle: KlineData, type: TradeType): boolean {
        const high = parseFloat(candle.high);
        const low = parseFloat(candle.low);
        const open = parseFloat(candle.open);
        const close = parseFloat(candle.close);
        
        const totalCandleHeight = high - low;
        const bodyHeight = Math.abs(close - open);
        
        if (type === 'LONG') {
            const upperWick = high - Math.max(open, close);
            const upperWickRatio = upperWick / totalCandleHeight;
            return upperWickRatio <= 0.8;
        } else {
            const lowerWick = Math.min(open, close) - low;
            const lowerWickRatio = lowerWick / totalCandleHeight;
            return lowerWickRatio <= 0.8;
        }
    }

    public async analyzeEntry(
        symbol: string, 
        type: TradeType, 
        entry: number, 
        stop: number,
        tp1: number
    ): Promise<{
        canEnter: boolean;
        currentClose: number;
        hasClosePriceBeforeEntry: boolean;
        message: string;
        warning: boolean;
    }> {
        try {
            // Calculate risk-reward ratio
            const entryToStopDistance = Math.abs(entry - stop);
            const entryToTP1Distance = Math.abs(entry - tp1);
            const riskRewardRatio = entryToTP1Distance / entryToStopDistance;

            // Get data from either Binance or BingX using DataServiceManager
            const { data: klineData, source } = await this.dataServiceManager.getKlineData(symbol);
            
            // Get the most recent close price
            const currentCandle = klineData[1];
            const currentClose = parseFloat(currentCandle.close);
            
            // Check if entry condition is met first
            const entryConditionMet = this.isEntryConditionMet(currentCandle, entry, type);
            let hasClosePriceBeforeEntry = false;
            if (entryConditionMet) {
                hasClosePriceBeforeEntry = this.hasClosePriceBeforeEntry(klineData, entry, type);
            }

            // Validate risk-reward ratio
            if (riskRewardRatio < 0.8) {
                return {
                    canEnter: false,
                    currentClose,
                    hasClosePriceBeforeEntry,
                    warning: entryConditionMet && hasClosePriceBeforeEntry,
                    message: `Invalid risk-reward ratio. Distance to TP1 (${entryToTP1Distance}) is less than 80% of distance to stop (${entryToStopDistance})`
                };
            }
            
            // Check if wick ratio is valid
            if (!this.isWickRatioValid(currentCandle, type)) {
                return {
                    canEnter: false,
                    currentClose,
                    hasClosePriceBeforeEntry,
                    warning: entryConditionMet && hasClosePriceBeforeEntry,
                    message: `Invalid candle wick ratio. ${type === 'LONG' ? 'Upper' : 'Lower'} wick is more than 80% of total candle height [${source}]`
                };
            }

            // Determine if we can enter the trade
            const canEnter = entryConditionMet && hasClosePriceBeforeEntry;

            // Generate appropriate message
            let message = '';
            if (!entryConditionMet) {
                message = `Entry condition not met. Current close (${currentClose}) is not ${type === 'LONG' ? 'above' : 'below'} entry (${entry}) [${source}]`;
            } else if (!hasClosePriceBeforeEntry) {
                message = `Entry condition met but no price has been close before entry (${entry}) [${source}]`;
            } else {
                message = `Entry condition met and price has been close before entry (${entry}) [${source}]`;
            }

            return {
                canEnter,
                currentClose,
                hasClosePriceBeforeEntry,
                warning: false,
                message
            };
        } catch (error: any) {
            console.error(`Error analyzing entry for ${symbol}:`, error);
            throw new Error(`Failed to analyze entry for ${symbol}: ${error.message}`);
        }
    }
} 