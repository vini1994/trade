import { TradeEntryAnalyzer } from './TradeEntryAnalyzer';
import { VolumeAnalyzer, VolumeColor } from './VolumeAnalyzer';
import { KlineData } from './utils/types';

interface Trade {
    symbol: string;
    type: 'LONG' | 'SHORT';
    entry: number;
    stop: number;
    volume: boolean;
    tp1: number;
}

export class TradeValidator {
    private readonly tradeEntryAnalyzer: TradeEntryAnalyzer;
    private readonly volumeAnalyzer: VolumeAnalyzer;

    constructor() {
        this.tradeEntryAnalyzer = new TradeEntryAnalyzer();
        this.volumeAnalyzer = new VolumeAnalyzer();
    }

    private isVolumeValid(color: VolumeColor): boolean {
        return color === VolumeColor.YELLOW || 
               color === VolumeColor.ORANGE || 
               color === VolumeColor.RED;
    }

    public async validateTrade(trade: Trade): Promise<{
        isValid: boolean;
        entryAnalysis: {
            canEnter: boolean;
            currentClose: number;
            hasClosePriceBeforeEntry: boolean;
            message: string;
        };
        volumeAnalysis: {
            color: VolumeColor;
            stdBar: number;
            mean: number;
            std: number;
            currentVolume: number;
        };
        message: string;
    }> {
        try {
            // Run both analyses in parallel
            const [entryAnalysis, volumeAnalysis] = await Promise.all([
                this.tradeEntryAnalyzer.analyzeEntry(
                    trade.symbol,
                    trade.type,
                    trade.entry,
                    trade.stop,
                    trade.tp1
                ),
                this.volumeAnalyzer.analyzeVolume(trade.symbol)
            ]);

            

            // Check if both conditions are met
            const isEntryValid = entryAnalysis.canEnter;
            let isVolumeValid = this.isVolumeValid(volumeAnalysis.color);

            if (trade.volume == false) {
                isVolumeValid = true;
            }

            // Determine if the trade is valid
            const isValid = isEntryValid && isVolumeValid;

            // Generate appropriate message
            let message = '';
            if (!isEntryValid && !isVolumeValid) {
                message = `Trade is invalid: ${entryAnalysis.message} and volume is not high enough (${volumeAnalysis.color})`;
            } else if (!isEntryValid) {
                message = `Trade is invalid: ${entryAnalysis.message}`;
            } else if (!isVolumeValid) {
                message = `Trade is invalid: Volume is not high enough (${volumeAnalysis.color})`;
            } else {
                message = `Trade is valid: Entry conditions met and volume is high (${volumeAnalysis.color}) ${trade.volume ? 'with volume flag' : 'without volume flag'}`;
            }

            return {
                isValid,
                entryAnalysis,
                volumeAnalysis,
                message
            };
        } catch (error) {
            console.error(`Error validating trade for ${trade.symbol}:`, error);
            throw error;
        }
    }
} 