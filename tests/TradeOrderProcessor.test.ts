import { TradeOrderProcessor } from '../src/TradeOrderProcessor';

// Mocks das dependências
jest.mock('../src/TradeDatabase', () => ({
  TradeDatabase: jest.fn().mockImplementation(() => ({
    hasOrderDetails: jest.fn().mockResolvedValue(false),
    saveOrderDetails: jest.fn().mockResolvedValue(undefined),
    updateTradeStatus: jest.fn().mockResolvedValue(undefined)
  }))
}));

jest.mock('../src/OrderStatusChecker', () => ({
  OrderStatusChecker: jest.fn().mockImplementation(() => ({
    getMultipleOrderStatus: jest.fn().mockResolvedValue([
      ['order1', { status: 'FILLED', type: 'LIMIT' }],
      ['order2', { status: 'FILLED', type: 'LIMIT' }]
    ]),
    getOrderStatusWithDetails: jest.fn().mockResolvedValue({
      status: { status: 'FILLED', type: 'LIMIT' },
      executionDetails: {
        executedQuantity: 1,
        averagePrice: 100,
        createTime: Date.now(),
        updateTime: Date.now()
      },
      isFilled: true,
      isCanceled: false,
      isOpen: false
    })
  }))
}));

describe('TradeOrderProcessor', () => {
  let processor: TradeOrderProcessor;

  beforeEach(() => {
    processor = new TradeOrderProcessor();
  });

  it('should instantiate without errors', () => {
    expect(processor).toBeInstanceOf(TradeOrderProcessor);
  });

  it('should process a trade and call dependencies', async () => {
    const trade = {
      id: 1,
      entryOrderId: 'order1',
      stopOrderId: 'order2',
      tp1OrderId: null,
      tp2OrderId: null,
      tp3OrderId: null,
      trailingStopOrderId: null,
      entry: 100,
      stop: 90,
      leverage: 2,
      type: 'LONG'
    };

    const db = require('../src/TradeDatabase').TradeDatabase.mock.instances[0];
    const checker = require('../src/OrderStatusChecker').OrderStatusChecker.mock.instances[0];

    await processor['processTrade'](trade);

    expect(checker.getMultipleOrderStatus).toHaveBeenCalled();
    expect(checker.getOrderStatusWithDetails).toHaveBeenCalled();
    expect(db.saveOrderDetails).toHaveBeenCalled();
    expect(db.updateTradeStatus).toHaveBeenCalled();
  });

  it('should skip orders with status NEW', async () => {
    const checker = require('../src/OrderStatusChecker').OrderStatusChecker.mock.instances[0];
    checker.getMultipleOrderStatus.mockResolvedValue([
      ['order1', { status: 'NEW', type: 'LIMIT' }]
    ]);

    const trade = {
      id: 2,
      entryOrderId: 'order1',
      stopOrderId: null,
      tp1OrderId: null,
      tp2OrderId: null,
      tp3OrderId: null,
      trailingStopOrderId: null,
      entry: 100,
      stop: 90,
      leverage: 2,
      type: 'LONG'
    };

    // Não deve chamar getOrderStatusWithDetails nem saveOrderDetails
    const db = require('../src/TradeDatabase').TradeDatabase.mock.instances[0];
    await processor['processTrade'](trade);

    expect(checker.getOrderStatusWithDetails).not.toHaveBeenCalled();
    expect(db.saveOrderDetails).not.toHaveBeenCalled();
  });
}); 