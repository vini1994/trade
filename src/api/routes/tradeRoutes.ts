import { Router } from 'express';
import { TradeController } from '../controllers/tradeController';

const router = Router();
const tradeController = new TradeController();

router.get('/trades', (req, res) => tradeController.listTrades(req, res));
router.get('/trades/:index', (req, res) => tradeController.getTrade(req, res));
router.post('/trades', (req, res) => tradeController.addTrade(req, res));
router.put('/trades/:index', (req, res) => tradeController.updateTrade(req, res));
router.delete('/trades/:index', (req, res) => tradeController.deleteTrade(req, res));

export default router; 