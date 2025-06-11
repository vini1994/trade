import { TradeEntryAnalyzer } from './TradeEntryAnalyzer';
import { VolumeAnalyzer, VolumeColor } from './VolumeAnalyzer';
import { KlineData, Trade, AllowedInterval } from './utils/types';


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
            warning: boolean;
        };
        volumeAnalysis: {
            color: VolumeColor;
            stdBar: number;
            mean: number;
            std: number;
            currentVolume: number;
        };
        message: string;
        warning: boolean;
        recentCloses: number[];
    }> {
        try {
            // Run both analyses in parallel
            const [entryAnalysis, volumeAnalysis] = await Promise.all([
                this.tradeEntryAnalyzer.analyzeEntry(
                    trade
                ),
                this.volumeAnalyzer.analyzeVolume(trade.symbol)
            ]);

            // Get recent closes from entry analysis
            const recentCloses = await this.tradeEntryAnalyzer.getRecentCloses(trade, 3);

            // Check if both conditions are met
            const isEntryValid = entryAnalysis.canEnter;
            let isVolumeValid = this.isVolumeValid(volumeAnalysis.color);

            // Handle volume validation based on volume_required
            if (trade.volume_required) {
                // If volume_required is true, volume must be valid
                isVolumeValid = this.isVolumeValid(volumeAnalysis.color);
            } else {
                // If volume_required is false, volume is optional
                isVolumeValid = true;
            }

            // Determine if the trade is valid
            const isValid = isEntryValid && isVolumeValid;

            // Set warning flag - true if entry has warning or if entry is valid but volume is invalid
            const warning = entryAnalysis.warning || (isEntryValid && !isVolumeValid && trade.volume_required);

            // Generate appropriate message
            let message = '';
            if (!isEntryValid && !isVolumeValid && trade.volume_required) {
                message = `Trade is invalid: ${entryAnalysis.message} and volume is not high enough (${volumeAnalysis.color})`;
            } else if (!isEntryValid) {
                message = `Trade is invalid: ${entryAnalysis.message}`;
            } else if (!isVolumeValid && trade.volume_required) {
                message = `Trade is invalid: Volume is not high enough (${volumeAnalysis.color})`;
            } else {
                let volumeStatus = '';
                if (trade.volume_required) {
                    volumeStatus = `volume is high (${volumeAnalysis.color})`;
                } else {
                    volumeStatus = `volume is optional (${volumeAnalysis.color})`;
                }
                if (trade.volume_adds_margin) {
                    volumeStatus += ' and will add margin';
                }
                message = `Trade is valid: Entry conditions met and ${volumeStatus}`;
            }

            return {
                isValid,
                entryAnalysis,
                volumeAnalysis,
                message,
                warning,
                recentCloses
            };
        } catch (error) {
            console.error(`Error validating trade for ${trade.symbol}:`, error);
            throw error;
        }
    }
}