import { BinanceDataService } from './BinanceDataService';
import { BingXDataService } from './BingXDataService';

export enum VolumeColor {
    RED = 'red',
    ORANGE = 'orange',
    YELLOW = 'yellow',
    WHITE = 'white',
    BLUE = 'blue'
}

export class VolumeAnalyzer {
    private readonly binanceService: BinanceDataService;
    private readonly bingxService: BingXDataService;
    private readonly thresholdExtraHigh: number = 4;
    private readonly thresholdHigh: number = 2.5;
    private readonly thresholdMedium: number = 1;
    private readonly thresholdNormal: number = -0.5;

    constructor() {
        this.binanceService = new BinanceDataService();
        this.bingxService = new BingXDataService();
    }

    private calculateMean(volumes: number[]): number {
        return volumes.reduce((sum, volume) => sum + volume, 0) / volumes.length;
    }

    private calculateStd(volumes: number[], mean: number): number {
        const squaredDifferences = volumes.map(volume => Math.pow(volume - mean, 2));
        const variance = squaredDifferences.reduce((sum, diff) => sum + diff, 0) / volumes.length;
        return Math.sqrt(variance);
    }

    private calculateStdBar(currentVolume: number, mean: number, std: number): number {
        return (currentVolume - mean) / std;
    }

    private getVolumeColor(stdBar: number): VolumeColor {
        if (stdBar > this.thresholdExtraHigh) return VolumeColor.RED;
        if (stdBar > this.thresholdHigh) return VolumeColor.ORANGE;
        if (stdBar > this.thresholdMedium) return VolumeColor.YELLOW;
        if (stdBar > this.thresholdNormal) return VolumeColor.WHITE;
        return VolumeColor.BLUE;
    }

    public async analyzeVolume(symbol: string): Promise<{
        color: VolumeColor;
        stdBar: number;
        mean: number;
        std: number;
        currentVolume: number;
    }> {
        try {
            // Try Binance first
            const klineData = await this.binanceService.getKlineData(symbol);
            const volumes = klineData.map(kline => parseFloat(kline.volume));
            const currentVolume = volumes[volumes.length - 1];
            const mean = this.calculateMean(volumes);
            const std = this.calculateStd(volumes, mean);
            const stdBar = this.calculateStdBar(currentVolume, mean, std);
            const color = this.getVolumeColor(stdBar);

            return {
                color,
                stdBar,
                mean,
                std,
                currentVolume
            };
        } catch (error) {
            console.error(`Error analyzing volume for ${symbol} on Binance, trying BingX:`, error);
            // Fallback to BingX if Binance fails
            try {
                const klineData = await this.bingxService.getKlineData(symbol);
                // On BingX, volume is already a number
                const volumes = klineData.map(kline => kline.volume);
                const currentVolume = volumes[volumes.length - 1];
                const mean = this.calculateMean(volumes);
                const std = this.calculateStd(volumes, mean);
                const stdBar = this.calculateStdBar(currentVolume, mean, std);
                const color = this.getVolumeColor(stdBar);

                return {
                    color,
                    stdBar,
                    mean,
                    std,
                    currentVolume
                };
            } catch (bingxError) {
                console.error(`Error analyzing volume for ${symbol} on BingX:`, bingxError);
                throw new Error(`Failed to analyze volume for ${symbol} using both Binance and BingX`);
            }
        }
    }
} 