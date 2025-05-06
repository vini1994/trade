import { BinanceDataService } from './BinanceDataService';
import { BingXDataService } from './BingXDataService';

export type TradeType = 'LONG' | 'SHORT';

export class TradeEntryAnalyzer {
    private readonly binanceService: BinanceDataService;
    private readonly bingxService: BingXDataService;

    constructor() {
        this.binanceService = new BinanceDataService();
        this.bingxService = new BingXDataService();
    }

    private isEntryConditionMet(currentClose: number, entry: number, type: TradeType): boolean {
        if (type === 'LONG') {
            return currentClose >= entry;
        } else {
            return currentClose <= entry;
        }
    }

    private hasPriceInRange(klineData: any[], entry: number, stop: number, type: TradeType): boolean {
        // Sort by close time in descending order (most recent first)
        const sortedData = [...klineData].sort((a, b) => b.time - a.time);
        
        // Skip the most recent candle as we already checked it
        const dataToCheck = sortedData.slice(1);

        for (const kline of dataToCheck) {
            const close = kline.close;
            
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
            // Try Binance first
            const klineData = await this.binanceService.getKlineData(symbol);
            
            // Get the most recent close price
            const currentClose = Number(klineData[0].close);
            
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
                message = `Entry condition not met. Current close (${currentClose}) is not ${type === 'LONG' ? 'above' : 'below'} entry (${entry})`;
            } else if (hasPriceInRange) {
                message = `Entry condition met but price has been between stop (${stop}) and entry (${entry})`;
            } else {
                message = `Entry condition met and no price has been between stop (${stop}) and entry (${entry})`;
            }

            return {
                canEnter,
                currentClose,
                hasPriceInRange,
                message
            };
        } catch (error) {
            console.error(`Error with Binance data for ${symbol}, trying BingX:`, error);
            
            try {
                // Try BingX as fallback
                const klineData = await this.bingxService.getKlineData(symbol);
                
                // Get the most recent close price
                const currentClose = Number(klineData[0].close);
                
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
                    message = `Entry condition not met. Current close (${currentClose}) is not ${type === 'LONG' ? 'above' : 'below'} entry (${entry}) [BingX]`;
                } else if (hasPriceInRange) {
                    message = `Entry condition met but price has been between stop (${stop}) and entry (${entry}) [BingX]`;
                } else {
                    message = `Entry condition met and no price has been between stop (${stop}) and entry (${entry}) [BingX]`;
                }

                return {
                    canEnter,
                    currentClose,
                    hasPriceInRange,
                    message
                };
            } catch (bingxError) {
                console.error(`Error with BingX data for ${symbol}:`, bingxError);
                throw new Error(`Failed to analyze entry for ${symbol} using both Binance and BingX`);
            }
        }
    }
} 