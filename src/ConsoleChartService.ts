import { KlineData } from './utils/types';

export class ConsoleChartService {
    private readonly chartWidth: number = 100;
    private readonly chartHeight: number = 50;
    private readonly priceLabelWidth: number = 12;
    private readonly timeLabelHeight: number = 2;
    private readonly maxCandles: number = 55;  // Maximum number of candles to display

    constructor() {}

    private findMinMax(data: KlineData[]): { min: number; max: number } {
        let min = Number.MAX_VALUE;
        let max = Number.MIN_VALUE;

        data.forEach(kline => {
            const high = parseFloat(kline.high);
            const low = parseFloat(kline.low);
            min = Math.min(min, low);
            max = Math.max(max, high);
        });

        const padding = (max - min) * 0.05;
        return { 
            min: min - padding, 
            max: max + padding 
        };
    }

    private normalizePrice(price: number, min: number, max: number): number {
        return Math.floor(((price - min) / (max - min)) * (this.chartHeight - 1));
    }

    private formatPrice(price: number): string {
        return price.toFixed(2).padStart(this.priceLabelWidth);
    }

    private formatTime(timestamp: number): string {
        const date = new Date(timestamp);
        return date.toLocaleTimeString();
    }

    private createChartLine(data: KlineData[], min: number, max: number): string[] {
        const chart: string[] = Array(this.chartHeight).fill('');
        const lastCandles = data.slice(-this.maxCandles);  // Get only the last 10 candles

        lastCandles.forEach(kline => {
            const open = parseFloat(kline.open);
            const close = parseFloat(kline.close);
            const high = parseFloat(kline.high);
            const low = parseFloat(kline.low);

            const openY = this.normalizePrice(open, min, max);
            const closeY = this.normalizePrice(close, min, max);
            const highY = this.normalizePrice(high, min, max);
            const lowY = this.normalizePrice(low, min, max);

            for (let y = 0; y < this.chartHeight; y++) {
                if ((y === highY) || (y < highY && y > (close >= open ? closeY : openY) )) {
                    chart[y] += '│';
                } else if ((y === lowY) || (y > lowY && y < (close >= open ? openY : closeY) )) {    
                    chart[y] += '│';
                } else if (y > Math.min(openY, closeY) && y < Math.max(openY, closeY)) {
                    chart[y] += close >= open ? '1' : '0';
                } else if (y === openY || y === closeY) {
                    chart[y] += close >= open ? '1' : '0';
                } else {
                    chart[y] += ' ';
                }
            }
        });

        return chart;
    }

    public drawChart(data: KlineData[], title: string): void {
        const lastCandles = data.slice(-this.maxCandles);
        const { min, max } = this.findMinMax(lastCandles);
        const chart = this.createChartLine(data, min, max);

        const priceStep = (max - min) / (this.chartHeight - 1);

        console.log('\n' + '='.repeat(this.chartWidth + this.priceLabelWidth + 2));
        console.log(title.padStart((this.chartWidth + this.priceLabelWidth + 2) / 2 + title.length / 2));
        console.log('='.repeat(this.chartWidth + this.priceLabelWidth + 2));

        for (let y = this.chartHeight - 1; y >= 0; y--) {
            const price = min + priceStep * y;
            console.log(`${this.formatPrice(price)} ${chart[y]}`);
        }

        console.log('='.repeat(this.chartWidth + this.priceLabelWidth + 2));
        
        const timeLabels = [
            this.formatTime(lastCandles[lastCandles.length - 1].openTime),
            this.formatTime(lastCandles[Math.floor(lastCandles.length / 2)].openTime),
            this.formatTime(lastCandles[0].openTime)
        ];
        
        const timeLabelSpacing = Math.floor(this.chartWidth / 2);
        console.log('Time →'.padStart(this.priceLabelWidth + 2) + 
                   timeLabels[0].padStart(timeLabelSpacing) + 
                   timeLabels[1].padStart(timeLabelSpacing) + 
                   timeLabels[2].padStart(timeLabelSpacing));
        
        console.log('='.repeat(this.chartWidth + this.priceLabelWidth + 2) + '\n');
    }
} 