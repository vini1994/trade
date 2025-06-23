import { KlineData, TradeType } from './types';

export interface Detail {
    high: number;
    low: number;
    mid: number;
}

export interface Zone {
    type: 'ORDER_BLOCK' | 'FVG';
    candleIndex: number;
    price: number;
    candle: KlineData;
    mitigated: boolean;
    details: Detail;
}

export class OrderBlockAndFVGDetector {
    /**
     * Encontra order blocks e FVGs de 50% não mitigados na direção do side
     * @param klineData Array de KlineData (ordem: mais antigo para mais recente)
     * @param side 'LONG' ou 'SHORT'
     */
    public static findUnmitigatedZones(klineData: KlineData[], side: TradeType): Zone[] {
        const fvgs: Zone[] = this.findFVGs(klineData, side);
        const orderBlocks: Zone[] = this.findOrderBlocks(klineData, side, fvgs);
        // Checar mitigação
        const allZones = [...orderBlocks, ...fvgs];
        console.log(allZones)
        for (const zone of allZones) {
            zone.mitigated = this.isMitigated(klineData, zone, side);
        }
        // Retornar apenas não mitigados
        return allZones.filter(z => !z.mitigated);
    }

    private static findOrderBlocks(klineData: KlineData[], side: TradeType, fvgs: Zone[]): Zone[] {
        // Nova lógica: todo candle que tiver um FVG é um order block, independente da cor
        const allOBs: Zone[] = [];
        for (const fvg of fvgs) {
            const candleIndex = fvg.candleIndex-1;
            const candle = klineData[candleIndex]
            const obHigh = parseFloat(candle.high);
            const obLow = parseFloat(candle.low);
            const ob50 = (obLow + obHigh) / 2;
            const ob: Zone = {
                type: 'ORDER_BLOCK',
                candleIndex,
                price: ob50,
                candle,
                mitigated: false,
                details: { high: obHigh, low:obLow, mid:ob50 }
            };
            allOBs.push(ob);
        }
        // Filtrar para manter apenas o mais antigo em sequências de candleIndex consecutivos
        const filteredOBs: Zone[] = [];
        allOBs.sort((a, b) => a.candleIndex - b.candleIndex);
        for (let i = 0; i < allOBs.length; i++) {
            if (i > 0 && allOBs[i].candleIndex === allOBs[i-1].candleIndex + 1) {
                // Se for sequência, ignore o atual
                continue;
            }
            filteredOBs.push(allOBs[i]);
        }
        return filteredOBs;
    }

    private static findFVGs(klineData: KlineData[], side: TradeType): Zone[] {
        const result: Zone[] = [];
        for (let i = 1; i < klineData.length - 1; i++) {
            const prev = klineData[i - 1];
            const curr = klineData[i];
            const next = klineData[i + 1];
            if (side === 'LONG') {
                // FVG de alta: gap entre o fechamento anterior e a mínima da próxima
                if (parseFloat(prev.close) < parseFloat(next.low)) {
                    const fvgLow = parseFloat(prev.close);
                    const fvgHigh = parseFloat(next.low);
                    const fvg50 = (fvgLow + fvgHigh) / 2;
                    result.push({
                        type: 'FVG',
                        candleIndex: i,
                        price: fvg50,
                        candle: curr,
                        mitigated: false,
                        details: { high: fvgHigh, low:fvgLow, mid:fvg50 }
                    });
                }
            } else {
                // FVG de baixa: gap entre o fechamento anterior e a máxima da próxima
                if (parseFloat(prev.close) > parseFloat(next.high)) {
                    const fvgHigh = parseFloat(prev.close);
                    const fvgLow = parseFloat(next.high);
                    const fvg50 = (fvgHigh + fvgLow) / 2;
                    result.push({
                        type: 'FVG',
                        candleIndex: i,
                        price: fvg50,
                        candle: curr,
                        mitigated: false,
                        details: { high: fvgHigh, low:fvgLow, mid:fvg50 }
                    });
                }
            }
        }
        return result;
    }

    private static isMitigated(klineData: KlineData[], zone: Zone, side: TradeType): boolean {
        // Verifica se após a formação, o preço tocou o OB ou o 50% do FVG
        const { candleIndex, price, type, details } = zone;
        for (let i = candleIndex + 1; i < klineData.length; i++) {
            const candle = klineData[i];
            if (type === 'ORDER_BLOCK') {
                if ((side === 'LONG') && parseFloat(candle.high) >= details.low) return true;
                if ((side === 'SHORT') && parseFloat(candle.low) >= details.high) return true;
            } else if (type === 'FVG') {
                if ((side === 'LONG') && parseFloat(candle.high) >= price) return true;
                if ((side === 'SHORT') && parseFloat(candle.low) >= price) return true;
            }
        }
        return false;
    }

    private static isBullish(candle: KlineData): boolean {
        return parseFloat(candle.close) > parseFloat(candle.open);
    }
    private static isBearish(candle: KlineData): boolean {
        return parseFloat(candle.close) < parseFloat(candle.open);
    }
}

