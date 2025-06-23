import { DataServiceManager } from '../DataServiceManager';
import { OrderBlockAndFVGDetector } from '../utils/OrderBlockAndFVGDetector';
import { TradeType, AllowedInterval } from '../utils/types';

export class ZoneAnalysisService {
    private dataServiceManager: DataServiceManager;

    constructor() {
        this.dataServiceManager = new DataServiceManager();
    }

    /**
     * Analisa zonas de Order Block e FVG não mitigadas
     * @param symbol símbolo do ativo
     * @param side 'LONG' ou 'SHORT'
     * @param entry preço de entrada
     * @param stop preço de stop
     * @param interval intervalo do kline (opcional, default '1h')
     */
    public async analyzeZones(symbol: string, side: TradeType, entry: number, stop: number, interval: AllowedInterval = '1h') {
        // Busca os dados de kline (limit 500)
        const { data: klineData } = await this.dataServiceManager.getKlineData(symbol, interval, 1000);
        // Chama o detector de zonas
        const zones = OrderBlockAndFVGDetector.findUnmitigatedZones(klineData, side);
        return zones;
    }
} 