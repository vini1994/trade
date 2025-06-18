import { Router } from 'express';
import { PositionHistoryController } from '../controllers/positionHistoryController';

const router = Router();
const positionHistoryController = new PositionHistoryController();

router.get('/position-history', (req, res) => positionHistoryController.getPositionHistory(req, res));
router.get('/position-history/stats', (req, res) => positionHistoryController.getPositionStats(req, res));
router.get('/position-history/risk-stats', (req, res) => positionHistoryController.getDetailedRiskStats(req, res));
router.get('/position-history/symbols', (req, res) => positionHistoryController.getAvailableSymbols(req, res));
router.get('/position-history/setup-descriptions', (req, res) => positionHistoryController.getAvailableSetupDescriptions(req, res));
router.get('/position-history/:positionId/trade', (req, res) => positionHistoryController.getPositionWithTradeInfo(req, res));

export default router; 