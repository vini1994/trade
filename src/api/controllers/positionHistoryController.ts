import { Request, Response } from 'express';
import { PositionHistoryService } from '../services/PositionHistoryService';

export class PositionHistoryController {
    private positionHistoryService: PositionHistoryService;

    constructor() {
        this.positionHistoryService = new PositionHistoryService();
        this.initialize();
    }

    private async initialize(): Promise<void> {
        // Se necessário, inicialize o banco de dados aqui
        // await this.positionHistoryService.initialize();
    }

    /**
     * Denormalizes a symbol from BingX format (e.g., "BTC-USDT") to original format (e.g., "BTCUSDT")
     */
    private denormalizeSymbolBingX(symbol: string): string {
        if (symbol === 'ALL') {
            return symbol;
        }
        // Remove the dash and convert to uppercase
        return symbol.replace('-', '').toUpperCase();
    }

    public async getPositionHistory(req: Request, res: Response): Promise<void> {
        try {
            const { 
                symbol = 'ALL', 
                setupDescription,
                startTs, 
                endTs
            } = req.query;

            const positions = await this.positionHistoryService.getPositionHistory(
                symbol as string,
                startTs ? parseInt(startTs as string) : undefined,
                endTs ? parseInt(endTs as string) : undefined,
                1,
                100000
            );

            let positionsWithTradeInfo = await this.positionHistoryService.enrichPositionsWithTradeInfo(positions);

            if (setupDescription && setupDescription !== 'ALL') {
                positionsWithTradeInfo = positionsWithTradeInfo.filter(position => 
                    position.tradeInfo?.found && 
                    position.tradeInfo.trade?.setup_description === setupDescription
                );
            }

            res.json({
                success: true,
                data: positionsWithTradeInfo,
                total: positionsWithTradeInfo.length
            });
        } catch (error) {
            console.error('Error fetching position history:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch position history'
            });
        }
    }

    public async getPositionStats(req: Request, res: Response): Promise<void> {
        try {
            const { symbol = 'ALL', setupDescription, startTs, endTs } = req.query;

            const positions = await this.positionHistoryService.getPositionHistory(
                symbol as string,
                startTs ? parseInt(startTs as string) : undefined,
                endTs ? parseInt(endTs as string) : undefined,
                1,
                100000
            );

            let positionsWithTradeInfo = await this.positionHistoryService.enrichPositionsWithTradeInfo(positions);

            if (setupDescription && setupDescription !== 'ALL') {
                positionsWithTradeInfo = positionsWithTradeInfo.filter(position => 
                    position.tradeInfo?.found && 
                    position.tradeInfo.trade?.setup_description === setupDescription
                );
            }

            const stats = this.positionHistoryService.calculateStats(positionsWithTradeInfo);

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            console.error('Error calculating position stats:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to calculate position stats'
            });
        }
    }

    public async getAvailableSymbols(req: Request, res: Response): Promise<void> {
        try {
            const positions = await this.positionHistoryService.getPositionHistory('ALL', undefined, undefined, 1, 100000);
            const symbols = [...new Set(positions.map(p => p.symbol))].sort();
            res.json({
                success: true,
                data: symbols
            });
        } catch (error) {
            console.error('Error fetching available symbols:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch available symbols'
            });
        }
    }

    public async getPositionWithTradeInfo(req: Request, res: Response): Promise<void> {
        try {
            const { positionId } = req.params;
            const positions = await this.positionHistoryService.getPositionHistory('ALL', undefined, undefined, 1, 100000);
            const position = positions.find(p => p.positionId === positionId);
            if (!position) {
                res.status(404).json({
                    success: false,
                    error: 'Position not found'
                });
                return;
            }
            const tradeInfo = await this.positionHistoryService.findTradeForPosition(position);
            res.json({
                success: true,
                data: {
                    position,
                    tradeInfo
                }
            });
        } catch (error) {
            console.error('Error fetching position with trade info:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch position with trade info'
            });
        }
    }

    public async getDetailedRiskStats(req: Request, res: Response): Promise<void> {
        try {
            const { symbol = 'ALL', setupDescription, startTs, endTs } = req.query;
            const positions = await this.positionHistoryService.getPositionHistory(
                symbol as string,
                startTs ? parseInt(startTs as string) : undefined,
                endTs ? parseInt(endTs as string) : undefined,
                1,
                100000
            );
            let positionsWithTradeInfo = await this.positionHistoryService.enrichPositionsWithTradeInfo(positions);
            if (setupDescription && setupDescription !== 'ALL') {
                positionsWithTradeInfo = positionsWithTradeInfo.filter(position => 
                    position.tradeInfo?.found && 
                    position.tradeInfo.trade?.setup_description === setupDescription
                );
            }
            const detailedStats = this.positionHistoryService.calculateDetailedRiskStats(positionsWithTradeInfo);
            res.json({
                success: true,
                data: detailedStats
            });
        } catch (error) {
            console.error('Error calculating detailed risk stats:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to calculate detailed risk stats'
            });
        }
    }

    public async getAvailableSetupDescriptions(req: Request, res: Response): Promise<void> {
        try {
            const allTrades = await this.positionHistoryService.getAllTrades();
            const setupDescriptions = [...new Set(allTrades.map(trade => trade.setup_description).filter(Boolean))].sort();
            res.json({
                success: true,
                data: setupDescriptions
            });
        } catch (error) {
            console.error('Error fetching available setup descriptions:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch available setup descriptions'
            });
        }
    }
} 