import { Request, Response } from 'express';
import { DatabasePositionHistoryService } from '../../services/DatabasePositionHistoryService';
import { TradeDatabase } from '../../TradeDatabase';
import * as fs from 'fs';
import * as path from 'path';

export class PositionHistoryController {
    private dbService: DatabasePositionHistoryService;
    private tradeDatabase: TradeDatabase;

    constructor() {
        this.dbService = DatabasePositionHistoryService.getInstance();
        this.tradeDatabase = new TradeDatabase();
        this.initialize();
    }

    private async initialize(): Promise<void> {
        await this.dbService.initialize();
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

            // Fetch all positions without pagination
            const positions = await this.dbService.getPositionHistory(
                symbol as string,
                startTs ? parseInt(startTs as string) : undefined,
                endTs ? parseInt(endTs as string) : undefined,
                1,
                100000 // Fetch a very high number to get all positions
            );

            // Always include trade info that generated each position
            let positionsWithTradeInfo = await this.enrichPositionsWithTradeInfo(positions);

            // Filter by setup_description if provided
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

            // Get all positions for stats calculation without pagination
            const positions = await this.dbService.getPositionHistory(
                symbol as string,
                startTs ? parseInt(startTs as string) : undefined,
                endTs ? parseInt(endTs as string) : undefined,
                1,
                100000 // Get a very high number to get all positions
            );

            // Enrich positions with trade info
            let positionsWithTradeInfo = await this.enrichPositionsWithTradeInfo(positions);

            // Filter by setup_description if provided
            if (setupDescription && setupDescription !== 'ALL') {
                positionsWithTradeInfo = positionsWithTradeInfo.filter(position => 
                    position.tradeInfo?.found && 
                    position.tradeInfo.trade?.setup_description === setupDescription
                );
            }

            const stats = this.calculateStats(positionsWithTradeInfo);

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
            // Get all positions to extract unique symbols without pagination
            const positions = await this.dbService.getPositionHistory('ALL', undefined, undefined, 1, 100000);
            
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

            // Fetch the specific position without pagination
            const positions = await this.dbService.getPositionHistory('ALL', undefined, undefined, 1, 100000);
            const position = positions.find(p => p.positionId === positionId);

            if (!position) {
                res.status(404).json({
                    success: false,
                    error: 'Position not found'
                });
                return;
            }

            // Encontrar o trade que gerou esta posição
            const tradeInfo = await this.findTradeForPosition(position);

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

    private async enrichPositionsWithTradeInfo(positions: any[]): Promise<any[]> {
        const enrichedPositions = [];

        for (const position of positions) {
            const tradeInfo = await this.findTradeForPosition(position);
            enrichedPositions.push({
                ...position,
                tradeInfo
            });
        }

        return enrichedPositions;
    }

    private async findTradeForPosition(position: any): Promise<any> {
        try {
            // Denormalize the position symbol for comparison with trades
            const denormalizedPositionSymbol = this.denormalizeSymbolBingX(position.symbol);
            
            // Convert the position open timestamp to Date
            const positionOpenTime = new Date(position.openTime);
            
            // Fetch trades that match the symbol and side of the position
            // Use a ±30 minute time window to find the corresponding trade
            const timeWindow = 10 * 60 * 1000; // 30 minutes in milliseconds
            const startTime = new Date(positionOpenTime.getTime() - timeWindow);
            const endTime = new Date(positionOpenTime.getTime() + timeWindow);

            // Fetch all trades for the symbol
            const allTrades = await this.tradeDatabase.getAllTrades();

            if (position.positionId){
                // Filter trades by positionId
                const matchingTrades = allTrades.filter((trade: any) => {
                    return trade.positionId === position.positionId;
                });
                // If trades found, return the best match
                if (matchingTrades.length > 0) {
                    // If multiple trades found, choose the one closest to the position open date
                    let bestMatch = matchingTrades[0];
                    let smallestTimeDiff = Math.abs(new Date(bestMatch.createdAt).getTime() - positionOpenTime.getTime());

                    for (const trade of matchingTrades) {
                        const timeDiff = Math.abs(new Date(trade.createdAt).getTime() - positionOpenTime.getTime());
                        if (timeDiff < smallestTimeDiff) {
                            smallestTimeDiff = timeDiff;
                            bestMatch = trade;
                        }
                    }

                    return {
                        found: true,
                        source: 'trade',
                        trade: {
                            id: bestMatch.id,
                            symbol: bestMatch.symbol,
                            type: bestMatch.type,
                            entry: bestMatch.entry,
                            stop: bestMatch.stop,
                            tp1: bestMatch.tp1,
                            tp2: bestMatch.tp2,
                            tp3: bestMatch.tp3,
                            tp4: bestMatch.tp4,
                            tp5: bestMatch.tp5,
                            tp6: bestMatch.tp6,
                            quantity: bestMatch.quantity,
                            leverage: bestMatch.leverage,
                            status: bestMatch.status,
                            setup_description: bestMatch.setup_description,
                            createdAt: bestMatch.createdAt,
                            updatedAt: bestMatch.updatedAt,
                            timeDifference: Math.round(smallestTimeDiff / 1000 / 60) // difference in minutes
                        },
                        message: `Found matching trade (ID: ${bestMatch.id}) created ${Math.round(smallestTimeDiff / 1000 / 60)} minutes ${new Date(bestMatch.createdAt) < positionOpenTime ? 'before' : 'after'} position opening`
                    };
                }


            }


            
            // Filter trades by symbol and type (LONG/SHORT based on positionSide)
            const matchingTrades = allTrades.filter((trade: any) => {
                const tradeType = trade.type; // 'LONG' or 'SHORT'
                const positionSide = position.positionSide; // 'LONG' or 'SHORT'
                
                // Check if symbol and type match (using denormalized symbol)
                if (trade.symbol !== denormalizedPositionSymbol) return false;
                if (tradeType !== positionSide) return false;

                // Check if the trade was created within the time window
                const tradeCreatedAt = new Date(trade.createdAt);
                return tradeCreatedAt >= startTime && tradeCreatedAt <= endTime;
            });

            // If trades found, return the best match
            if (matchingTrades.length > 0) {
                // If multiple trades found, choose the one closest to the position open date
                let bestMatch = matchingTrades[0];
                let smallestTimeDiff = Math.abs(new Date(bestMatch.createdAt).getTime() - positionOpenTime.getTime());

                for (const trade of matchingTrades) {
                    const timeDiff = Math.abs(new Date(trade.createdAt).getTime() - positionOpenTime.getTime());
                    if (timeDiff < smallestTimeDiff) {
                        smallestTimeDiff = timeDiff;
                        bestMatch = trade;
                    }
                }

                return {
                    found: true,
                    source: 'trade',
                    trade: {
                        id: bestMatch.id,
                        symbol: bestMatch.symbol,
                        type: bestMatch.type,
                        entry: bestMatch.entry,
                        stop: bestMatch.stop,
                        tp1: bestMatch.tp1,
                        tp2: bestMatch.tp2,
                        tp3: bestMatch.tp3,
                        tp4: bestMatch.tp4,
                        tp5: bestMatch.tp5,
                        tp6: bestMatch.tp6,
                        quantity: bestMatch.quantity,
                        leverage: bestMatch.leverage,
                        status: bestMatch.status,
                        setup_description: bestMatch.setup_description,
                        createdAt: bestMatch.createdAt,
                        updatedAt: bestMatch.updatedAt,
                        timeDifference: Math.round(smallestTimeDiff / 1000 / 60) // difference in minutes
                    },
                    message: `Found matching trade (ID: ${bestMatch.id}) created ${Math.round(smallestTimeDiff / 1000 / 60)} minutes ${new Date(bestMatch.createdAt) < positionOpenTime ? 'before' : 'after'} position opening`
                };
            }

            // If no trades found, search in trades.json file
            const tradesJsonPath = path.join(__dirname, '../../../data/trades.json');
            
            if (!fs.existsSync(tradesJsonPath)) {
                return {
                    found: false,
                    message: 'No matching trade found for this position and trades.json file not found'
                };
            }

            const tradesJsonContent = fs.readFileSync(tradesJsonPath, 'utf8');
            const tradesFromJson = JSON.parse(tradesJsonContent);

            // Filter trades from JSON by symbol, type, and that have setup_description
            const matchingTradesFromJson = tradesFromJson.filter((trade: any) => {
                const tradeType = trade.type; // 'LONG' or 'SHORT'
                const positionSide = position.positionSide; // 'LONG' or 'SHORT'
                
                // Check if symbol and type match (using denormalized symbol)
                if (trade.symbol !== denormalizedPositionSymbol) return false;
                if (tradeType !== positionSide) return false;
                
                // Check if has setup_description
                if (!trade.setup_description || trade.setup_description.trim() === '') return false;

                return true;
            });

            if (matchingTradesFromJson.length === 0) {
                return {
                    found: false,
                    message: 'No matching trade or setup found for this position'
                };
            }

            // If multiple trades found in JSON, choose the first one (no timestamp to compare)
            const bestTradeFromJson = matchingTradesFromJson[0];

            return {
                found: true,
                source: 'trades.json',
                trade: {
                    id: null, // Trades from JSON do not have trade ID
                    symbol: bestTradeFromJson.symbol,
                    type: bestTradeFromJson.type,
                    entry: bestTradeFromJson.entry,
                    stop: bestTradeFromJson.stop,
                    tp1: bestTradeFromJson.tp1,
                    tp2: bestTradeFromJson.tp2,
                    tp3: bestTradeFromJson.tp3,
                    tp4: bestTradeFromJson.tp4,
                    tp5: bestTradeFromJson.tp5,
                    tp6: bestTradeFromJson.tp6,
                    quantity: null, // Trades from JSON do not have quantity
                    leverage: null, // Trades from JSON do not have leverage
                    status: 'SETUP', // Special status for setups from JSON
                    setup_description: bestTradeFromJson.setup_description,
                    interval: bestTradeFromJson.interval,
                    url_analysis: bestTradeFromJson.url_analysis,
                    volume_required: bestTradeFromJson.volume_required,
                    volume_adds_margin: bestTradeFromJson.volume_adds_margin,
                    createdAt: null, // Trades from JSON do not have timestamp
                    updatedAt: null,
                    timeDifference: null, // No timestamp to compare
                    is_valid: true,
                    is_warning: false,
                    execution_error: null
                },
                message: `Found matching trade setup from trades.json`
            };

        } catch (error) {
            console.error('[findTradeForPosition] Error finding trade for position:', error);
            return {
                found: false,
                message: 'Error occurred while searching for matching trade',
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    private calculateStats(positions: any[]): any {
        if (positions.length === 0) {
            return {
                totalPositions: 0,
                totalProfit: 0,
                totalLoss: 0,
                netProfit: 0,
                winRate: 0,
                avgProfit: 0,
                avgLoss: 0,
                maxProfit: 0,
                maxLoss: 0,
                profitBySymbol: {},
                profitBySide: { LONG: 0, SHORT: 0 },
                // Novas estatísticas baseadas no trade
                riskMetrics: {
                    totalRisk: 0,
                    avgRiskPerTrade: 0,
                    maxRiskPerTrade: 0,
                    riskRewardRatio: 0,
                    avgRiskRewardRatio: 0,
                    sharpeRatio: 0,
                    maxDrawdown: 0,
                    avgDrawdown: 0,
                    consecutiveWins: 0,
                    consecutiveLosses: 0,
                    maxConsecutiveWins: 0,
                    maxConsecutiveLosses: 0
                },
                tradeMetrics: {
                    totalTradesWithInfo: 0,
                    avgEntryPrice: 0,
                    avgStopPrice: 0,
                    avgTakeProfit1: 0,
                    avgLeverage: 0,
                    avgQuantity: 0,
                    mostProfitableSymbol: '',
                    mostProfitableSide: '',
                    bestTradeId: null,
                    worstTradeId: null
                }
            };
        }

        let totalProfit = 0;
        let totalLoss = 0;
        let winningTrades = 0;
        let losingTrades = 0;
        const profitBySymbol: { [key: string]: number } = {};
        const profitBySide: { [key: string]: number } = { LONG: 0, SHORT: 0 };
        
        // Arrays para cálculos de risco
        const profits: number[] = [];
        const risks: number[] = [];
        const riskRewardRatios: number[] = [];
        const drawdowns: number[] = [];
        let runningBalance = 0;
        let peakBalance = 0;
        let currentDrawdown = 0;
        let maxDrawdown = 0;
        
        // Contadores para sequências
        let currentConsecutiveWins = 0;
        let currentConsecutiveLosses = 0;
        let maxConsecutiveWins = 0;
        let maxConsecutiveLosses = 0;
        
        // Métricas do trade
        let totalTradesWithInfo = 0;
        let totalEntryPrice = 0;
        let totalStopPrice = 0;
        let totalTakeProfit1 = 0;
        let totalLeverage = 0;
        let totalQuantity = 0;
        const symbolProfits: { [key: string]: number } = {};
        const sideProfits: { [key: string]: number } = {};
        let bestTradeId = null;
        let worstTradeId = null;
        let bestProfit = -Infinity;
        let worstProfit = Infinity;

        positions.forEach((position, index) => {
            const netProfit = parseFloat(position.netProfit);
            profits.push(netProfit);
            
            // Atualizar sequências
            if (netProfit > 0) {
                currentConsecutiveWins++;
                currentConsecutiveLosses = 0;
                if (currentConsecutiveWins > maxConsecutiveWins) {
                    maxConsecutiveWins = currentConsecutiveWins;
                }
            } else {
                currentConsecutiveLosses++;
                currentConsecutiveWins = 0;
                if (currentConsecutiveLosses > maxConsecutiveLosses) {
                    maxConsecutiveLosses = currentConsecutiveLosses;
                }
            }
            
            if (netProfit > 0) {
                totalProfit += netProfit;
                winningTrades++;
            } else {
                totalLoss += Math.abs(netProfit);
                losingTrades++;
            }

            // Group by symbol
            if (!profitBySymbol[position.symbol]) {
                profitBySymbol[position.symbol] = 0;
                symbolProfits[position.symbol] = 0;
            }
            profitBySymbol[position.symbol] += netProfit;
            symbolProfits[position.symbol] += netProfit;

            // Group by position side
            if (!profitBySide[position.positionSide]) {
                profitBySide[position.positionSide] = 0;
                sideProfits[position.positionSide] = 0;
            }
            profitBySide[position.positionSide] += netProfit;
            sideProfits[position.positionSide] += netProfit;

            // Calcular drawdown
            runningBalance += netProfit;
            if (runningBalance > peakBalance) {
                peakBalance = runningBalance;
            }
            currentDrawdown = peakBalance - runningBalance;
            if (currentDrawdown > maxDrawdown) {
                maxDrawdown = currentDrawdown;
            }
            drawdowns.push(currentDrawdown);

            // Melhor e pior trade
            if (netProfit > bestProfit) {
                bestProfit = netProfit;
                bestTradeId = position.tradeInfo?.found ? position.tradeInfo.trade.id : null;
            }
            if (netProfit < worstProfit) {
                worstProfit = netProfit;
                worstTradeId = position.tradeInfo?.found ? position.tradeInfo.trade.id : null;
            }

            // Métricas baseadas no trade
            if (position.tradeInfo?.found) {
                totalTradesWithInfo++;
                const trade = position.tradeInfo.trade;
                
                // Calcular risco (distância do entry ao stop)
                const entryPrice = trade.entry;
                const stopPrice = trade.stop;
                const risk = Math.abs(entryPrice - stopPrice);
                risks.push(risk);
                
                // Calcular risco-retorno
                if (risk > 0) {
                    const riskRewardRatio = Math.abs(netProfit) / risk;
                    riskRewardRatios.push(riskRewardRatio);
                }
                
                // Acumular métricas do trade
                totalEntryPrice += entryPrice;
                totalStopPrice += stopPrice;
                if (trade.tp1) {
                    totalTakeProfit1 += trade.tp1;
                }
                totalLeverage += trade.leverage;
                totalQuantity += trade.quantity;
            }
        });

        const totalTrades = positions.length;
        const netProfit = totalProfit - totalLoss;
        const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
        const avgProfit = winningTrades > 0 ? totalProfit / winningTrades : 0;
        const avgLoss = losingTrades > 0 ? totalLoss / losingTrades : 0;

        const maxProfit = Math.max(...profits);
        const maxLoss = Math.min(...profits);

        // Calcular Sharpe Ratio (simplificado)
        const avgReturn = profits.reduce((sum, profit) => sum + profit, 0) / profits.length;
        const variance = profits.reduce((sum, profit) => sum + Math.pow(profit - avgReturn, 2), 0) / profits.length;
        const stdDev = Math.sqrt(variance);
        const sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;

        // Encontrar símbolo e lado mais lucrativos
        const mostProfitableSymbol = Object.keys(symbolProfits).reduce((a, b) => 
            symbolProfits[a] > symbolProfits[b] ? a : b, Object.keys(symbolProfits)[0] || '');
        const mostProfitableSide = Object.keys(sideProfits).reduce((a, b) => 
            sideProfits[a] > sideProfits[b] ? a : b, Object.keys(sideProfits)[0] || '');

        return {
            totalPositions: totalTrades,
            totalProfit,
            totalLoss,
            netProfit,
            winRate: Math.round(winRate * 100) / 100,
            avgProfit: Math.round(avgProfit * 100) / 100,
            avgLoss: Math.round(avgLoss * 100) / 100,
            maxProfit: Math.round(maxProfit * 100) / 100,
            maxLoss: Math.round(maxLoss * 100) / 100,
            profitBySymbol,
            profitBySide,
            
            // Novas estatísticas de risco
            riskMetrics: {
                totalRisk: risks.length > 0 ? Math.round(risks.reduce((sum, risk) => sum + risk, 0) * 100) / 100 : 0,
                avgRiskPerTrade: risks.length > 0 ? Math.round(risks.reduce((sum, risk) => sum + risk, 0) / risks.length * 100) / 100 : 0,
                maxRiskPerTrade: risks.length > 0 ? Math.round(Math.max(...risks) * 100) / 100 : 0,
                riskRewardRatio: risks.length > 0 && riskRewardRatios.length > 0 ? Math.round(riskRewardRatios.reduce((sum, ratio) => sum + ratio, 0) / riskRewardRatios.length * 100) / 100 : 0,
                avgRiskRewardRatio: riskRewardRatios.length > 0 ? Math.round(riskRewardRatios.reduce((sum, ratio) => sum + ratio, 0) / riskRewardRatios.length * 100) / 100 : 0,
                sharpeRatio: Math.round(sharpeRatio * 100) / 100,
                maxDrawdown: Math.round(maxDrawdown * 100) / 100,
                avgDrawdown: drawdowns.length > 0 ? Math.round(drawdowns.reduce((sum, dd) => sum + dd, 0) / drawdowns.length * 100) / 100 : 0,
                consecutiveWins: currentConsecutiveWins,
                consecutiveLosses: currentConsecutiveLosses,
                maxConsecutiveWins,
                maxConsecutiveLosses
            },
            
            // Métricas baseadas no trade
            tradeMetrics: {
                totalTradesWithInfo,
                avgEntryPrice: totalTradesWithInfo > 0 ? Math.round(totalEntryPrice / totalTradesWithInfo * 100) / 100 : 0,
                avgStopPrice: totalTradesWithInfo > 0 ? Math.round(totalStopPrice / totalTradesWithInfo * 100) / 100 : 0,
                avgTakeProfit1: totalTradesWithInfo > 0 ? Math.round(totalTakeProfit1 / totalTradesWithInfo * 100) / 100 : 0,
                avgLeverage: totalTradesWithInfo > 0 ? Math.round(totalLeverage / totalTradesWithInfo * 100) / 100 : 0,
                avgQuantity: totalTradesWithInfo > 0 ? Math.round(totalQuantity / totalTradesWithInfo * 100) / 100 : 0,
                mostProfitableSymbol,
                mostProfitableSide,
                bestTradeId,
                worstTradeId,
                bestProfit: Math.round(bestProfit * 100) / 100,
                worstProfit: Math.round(worstProfit * 100) / 100
            }
        };
    }

    public async getDetailedRiskStats(req: Request, res: Response): Promise<void> {
        try {
            const { symbol = 'ALL', setupDescription, startTs, endTs } = req.query;

            // Get all positions for detailed risk analysis
            const positions = await this.dbService.getPositionHistory(
                symbol as string,
                startTs ? parseInt(startTs as string) : undefined,
                endTs ? parseInt(endTs as string) : undefined,
                1,
                100000
            );

            // Enrich positions with trade info
            let positionsWithTradeInfo = await this.enrichPositionsWithTradeInfo(positions);

            // Filter by setup_description if provided
            if (setupDescription && setupDescription !== 'ALL') {
                positionsWithTradeInfo = positionsWithTradeInfo.filter(position => 
                    position.tradeInfo?.found && 
                    position.tradeInfo.trade?.setup_description === setupDescription
                );
            }

            const detailedStats = this.calculateDetailedRiskStats(positionsWithTradeInfo);

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

    private calculateDetailedRiskStats(positions: any[]): any {
        if (positions.length === 0) {
            return {
                summary: {
                    totalPositions: 0,
                    totalTradesWithInfo: 0,
                    totalProfit: 0,
                    totalLoss: 0,
                    netProfit: 0
                },
                riskAnalysis: {
                    avgRiskPerTrade: 0,
                    totalRisk: 0,
                    riskDistribution: {},
                    maxRiskPerTrade: 0,
                    minRiskPerTrade: 0
                },
                rewardAnalysis: {
                    avgRewardPerTrade: 0,
                    totalReward: 0,
                    rewardDistribution: {},
                    maxRewardPerTrade: 0,
                    minRewardPerTrade: 0
                },
                riskRewardAnalysis: {
                    avgRiskRewardRatio: 0,
                    riskRewardDistribution: {},
                    tradesWithPositiveRR: 0,
                    tradesWithNegativeRR: 0,
                    bestRiskRewardRatio: 0,
                    worstRiskRewardRatio: 0
                },
                performanceMetrics: {
                    sharpeRatio: 0,
                    sortinoRatio: 0,
                    calmarRatio: 0,
                    maxDrawdown: 0,
                    avgDrawdown: 0,
                    recoveryFactor: 0
                },
                tradeAnalysis: {
                    avgLeverage: 0,
                    leverageDistribution: {},
                    avgQuantity: 0,
                    quantityDistribution: {},
                    avgEntryPrice: 0,
                    avgStopPrice: 0,
                    avgTakeProfit1: 0
                },
                symbolAnalysis: {},
                sideAnalysis: {}
            };
        }

        const tradesWithInfo = positions.filter(p => p.tradeInfo?.found);
        const profits = positions.map(p => parseFloat(p.netProfit));
        const totalProfit = profits.reduce((sum, p) => p > 0 ? sum + p : sum, 0);
        const totalLoss = profits.reduce((sum, p) => p < 0 ? sum + Math.abs(p) : sum, 0);
        const netProfit = totalProfit - totalLoss;

        // Análise de risco
        const risks: number[] = [];
        const rewards: number[] = [];
        const riskRewardRatios: number[] = [];
        const leverages: number[] = [];
        const quantities: number[] = [];
        const entryPrices: number[] = [];
        const stopPrices: number[] = [];
        const takeProfit1s: number[] = [];

        // Distribuições
        const riskDistribution: { [key: string]: number } = {};
        const rewardDistribution: { [key: string]: number } = {};
        const rrDistribution: { [key: string]: number } = {};
        const leverageDistribution: { [key: string]: number } = {};
        const quantityDistribution: { [key: string]: number } = {};

        // Análise por símbolo e lado
        const symbolAnalysis: { [key: string]: any } = {};
        const sideAnalysis: { [key: string]: any } = {};

        tradesWithInfo.forEach(position => {
            const trade = position.tradeInfo.trade;
            const netProfit = parseFloat(position.netProfit);
            
            // Calcular risco (distância do entry ao stop)
            const risk = Math.abs(trade.entry - trade.stop);
            risks.push(risk);
            
            // Calcular reward (lucro/prejuízo)
            rewards.push(Math.abs(netProfit));
            
            // Calcular risk-reward ratio
            if (risk > 0) {
                const rrRatio = Math.abs(netProfit) / risk;
                riskRewardRatios.push(rrRatio);
            }
            
            // Acumular dados para distribuições
            leverages.push(trade.leverage);
            quantities.push(trade.quantity);
            entryPrices.push(trade.entry);
            stopPrices.push(trade.stop);
            if (trade.tp1) {
                takeProfit1s.push(trade.tp1);
            }

            // Análise por símbolo
            if (!symbolAnalysis[position.symbol]) {
                symbolAnalysis[position.symbol] = {
                    totalTrades: 0,
                    totalProfit: 0,
                    totalLoss: 0,
                    avgRisk: 0,
                    avgReward: 0,
                    avgRR: 0,
                    avgLeverage: 0,
                    risks: [],
                    rewards: [],
                    rrRatios: []
                };
            }
            symbolAnalysis[position.symbol].totalTrades++;
            symbolAnalysis[position.symbol].totalProfit += netProfit > 0 ? netProfit : 0;
            symbolAnalysis[position.symbol].totalLoss += netProfit < 0 ? Math.abs(netProfit) : 0;
            symbolAnalysis[position.symbol].risks.push(risk);
            symbolAnalysis[position.symbol].rewards.push(Math.abs(netProfit));
            if (risk > 0) {
                symbolAnalysis[position.symbol].rrRatios.push(Math.abs(netProfit) / risk);
            }

            // Análise por lado
            if (!sideAnalysis[position.positionSide]) {
                sideAnalysis[position.positionSide] = {
                    totalTrades: 0,
                    totalProfit: 0,
                    totalLoss: 0,
                    avgRisk: 0,
                    avgReward: 0,
                    avgRR: 0,
                    avgLeverage: 0,
                    risks: [],
                    rewards: [],
                    rrRatios: []
                };
            }
            sideAnalysis[position.positionSide].totalTrades++;
            sideAnalysis[position.positionSide].totalProfit += netProfit > 0 ? netProfit : 0;
            sideAnalysis[position.positionSide].totalLoss += netProfit < 0 ? Math.abs(netProfit) : 0;
            sideAnalysis[position.positionSide].risks.push(risk);
            sideAnalysis[position.positionSide].rewards.push(Math.abs(netProfit));
            if (risk > 0) {
                sideAnalysis[position.positionSide].rrRatios.push(Math.abs(netProfit) / risk);
            }
        });

        // Calcular médias para símbolos e lados
        Object.keys(symbolAnalysis).forEach(symbol => {
            const analysis = symbolAnalysis[symbol];
            analysis.avgRisk = analysis.risks.length > 0 ? analysis.risks.reduce((a: number, b: number) => a + b, 0) / analysis.risks.length : 0;
            analysis.avgReward = analysis.rewards.length > 0 ? analysis.rewards.reduce((a: number, b: number) => a + b, 0) / analysis.rewards.length : 0;
            analysis.avgRR = analysis.rrRatios.length > 0 ? analysis.rrRatios.reduce((a: number, b: number) => a + b, 0) / analysis.rrRatios.length : 0;
            analysis.avgLeverage = leverages.filter((_, i) => tradesWithInfo[i].symbol === symbol).reduce((a: number, b: number) => a + b, 0) / analysis.totalTrades;
        });

        Object.keys(sideAnalysis).forEach(side => {
            const analysis = sideAnalysis[side];
            analysis.avgRisk = analysis.risks.length > 0 ? analysis.risks.reduce((a: number, b: number) => a + b, 0) / analysis.risks.length : 0;
            analysis.avgReward = analysis.rewards.length > 0 ? analysis.rewards.reduce((a: number, b: number) => a + b, 0) / analysis.rewards.length : 0;
            analysis.avgRR = analysis.rrRatios.length > 0 ? analysis.rrRatios.reduce((a: number, b: number) => a + b, 0) / analysis.rrRatios.length : 0;
            analysis.avgLeverage = leverages.filter((_, i) => tradesWithInfo[i].positionSide === side).reduce((a: number, b: number) => a + b, 0) / analysis.totalTrades;
        });

        // Calcular distribuições
        risks.forEach(risk => {
            const range = Math.floor(risk / 10) * 10;
            const key = `${range}-${range + 10}`;
            riskDistribution[key] = (riskDistribution[key] || 0) + 1;
        });

        rewards.forEach(reward => {
            const range = Math.floor(reward / 10) * 10;
            const key = `${range}-${range + 10}`;
            rewardDistribution[key] = (rewardDistribution[key] || 0) + 1;
        });

        riskRewardRatios.forEach(rr => {
            const range = Math.floor(rr * 10) / 10;
            const key = `${range}-${range + 0.1}`;
            rrDistribution[key] = (rrDistribution[key] || 0) + 1;
        });

        leverages.forEach(leverage => {
            const range = Math.floor(leverage / 5) * 5;
            const key = `${range}-${range + 5}`;
            leverageDistribution[key] = (leverageDistribution[key] || 0) + 1;
        });

        quantities.forEach(quantity => {
            const range = Math.floor(quantity * 100) / 100;
            const key = `${range}-${range + 0.01}`;
            quantityDistribution[key] = (quantityDistribution[key] || 0) + 1;
        });

        // Calcular métricas de performance
        const avgReturn = profits.reduce((sum, profit) => sum + profit, 0) / profits.length;
        const variance = profits.reduce((sum, profit) => sum + Math.pow(profit - avgReturn, 2), 0) / profits.length;
        const stdDev = Math.sqrt(variance);
        const sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;

        // Calcular Sortino Ratio (usando apenas retornos negativos)
        const negativeReturns = profits.filter(p => p < 0);
        const downsideDeviation = negativeReturns.length > 0 ? 
            Math.sqrt(negativeReturns.reduce((sum, ret) => sum + Math.pow(ret, 2), 0) / negativeReturns.length) : 0;
        const sortinoRatio = downsideDeviation > 0 ? avgReturn / downsideDeviation : 0;

        // Calcular drawdown
        let runningBalance = 0;
        let peakBalance = 0;
        let maxDrawdown = 0;
        profits.forEach(profit => {
            runningBalance += profit;
            if (runningBalance > peakBalance) {
                peakBalance = runningBalance;
            }
            const drawdown = peakBalance - runningBalance;
            if (drawdown > maxDrawdown) {
                maxDrawdown = drawdown;
            }
        });

        const calmarRatio = maxDrawdown > 0 ? netProfit / maxDrawdown : 0;
        const recoveryFactor = maxDrawdown > 0 ? netProfit / maxDrawdown : 0;

        return {
            summary: {
                totalPositions: positions.length,
                totalTradesWithInfo: tradesWithInfo.length,
                totalProfit: Math.round(totalProfit * 100) / 100,
                totalLoss: Math.round(totalLoss * 100) / 100,
                netProfit: Math.round(netProfit * 100) / 100
            },
            riskAnalysis: {
                avgRiskPerTrade: risks.length > 0 ? Math.round(risks.reduce((a, b) => a + b, 0) / risks.length * 100) / 100 : 0,
                totalRisk: Math.round(risks.reduce((a, b) => a + b, 0) * 100) / 100,
                riskDistribution,
                maxRiskPerTrade: risks.length > 0 ? Math.round(Math.max(...risks) * 100) / 100 : 0,
                minRiskPerTrade: risks.length > 0 ? Math.round(Math.min(...risks) * 100) / 100 : 0
            },
            rewardAnalysis: {
                avgRewardPerTrade: rewards.length > 0 ? Math.round(rewards.reduce((a, b) => a + b, 0) / rewards.length * 100) / 100 : 0,
                totalReward: Math.round(rewards.reduce((a, b) => a + b, 0) * 100) / 100,
                rewardDistribution,
                maxRewardPerTrade: rewards.length > 0 ? Math.round(Math.max(...rewards) * 100) / 100 : 0,
                minRewardPerTrade: rewards.length > 0 ? Math.round(Math.min(...rewards) * 100) / 100 : 0
            },
            riskRewardAnalysis: {
                avgRiskRewardRatio: riskRewardRatios.length > 0 ? Math.round(riskRewardRatios.reduce((a, b) => a + b, 0) / riskRewardRatios.length * 100) / 100 : 0,
                riskRewardDistribution: rrDistribution,
                tradesWithPositiveRR: riskRewardRatios.filter(rr => rr > 1).length,
                tradesWithNegativeRR: riskRewardRatios.filter(rr => rr < 1).length,
                bestRiskRewardRatio: riskRewardRatios.length > 0 ? Math.round(Math.max(...riskRewardRatios) * 100) / 100 : 0,
                worstRiskRewardRatio: riskRewardRatios.length > 0 ? Math.round(Math.min(...riskRewardRatios) * 100) / 100 : 0
            },
            performanceMetrics: {
                sharpeRatio: Math.round(sharpeRatio * 100) / 100,
                sortinoRatio: Math.round(sortinoRatio * 100) / 100,
                calmarRatio: Math.round(calmarRatio * 100) / 100,
                maxDrawdown: Math.round(maxDrawdown * 100) / 100,
                avgDrawdown: 0, // Seria calculado se necessário
                recoveryFactor: Math.round(recoveryFactor * 100) / 100
            },
            tradeAnalysis: {
                avgLeverage: leverages.length > 0 ? Math.round(leverages.reduce((a, b) => a + b, 0) / leverages.length * 100) / 100 : 0,
                leverageDistribution,
                avgQuantity: quantities.length > 0 ? Math.round(quantities.reduce((a, b) => a + b, 0) / quantities.length * 100) / 100 : 0,
                quantityDistribution,
                avgEntryPrice: entryPrices.length > 0 ? Math.round(entryPrices.reduce((a, b) => a + b, 0) / entryPrices.length * 100) / 100 : 0,
                avgStopPrice: stopPrices.length > 0 ? Math.round(stopPrices.reduce((a, b) => a + b, 0) / stopPrices.length * 100) / 100 : 0,
                avgTakeProfit1: takeProfit1s.length > 0 ? Math.round(takeProfit1s.reduce((a, b) => a + b, 0) / takeProfit1s.length * 100) / 100 : 0
            },
            symbolAnalysis,
            sideAnalysis
        };
    }

    public async getAvailableSetupDescriptions(req: Request, res: Response): Promise<void> {
        try {
            // Fetch all trades to extract unique setup descriptions
            const allTrades = await this.tradeDatabase.getAllTrades();
            
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