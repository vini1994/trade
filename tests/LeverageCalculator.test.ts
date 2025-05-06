import { LeverageCalculator } from '../src/LeverageCalculator';

// Mock axios to avoid real HTTP requests
jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn()
}));

describe('LeverageCalculator', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV, BINGX_API_KEY: 'key', BINGX_API_SECRET: 'secret', BINGX_BASE_URL: 'http://mock' };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('should instantiate without errors when env vars are set', () => {
    expect(() => new LeverageCalculator()).not.toThrow();
  });

  it('should throw error if env vars are missing', () => {
    process.env.BINGX_API_KEY = '';
    process.env.BINGX_API_SECRET = '';
    expect(() => new LeverageCalculator()).toThrow();
  });

  it('should calculateTheoreticalMaxLeverage correctly', () => {
    const calc = new LeverageCalculator();
    expect((calc as any).calculateTheoreticalMaxLeverage(100, 90)).toBe(10);
    expect((calc as any).calculateTheoreticalMaxLeverage(100, 80)).toBe(5);
  });

  it('should calculate optimal leverage with safety margin and exchange max', async () => {
    const axios = require('axios');
    axios.get.mockResolvedValue({
      data: {
        code: 0,
        msg: 'ok',
        data: {
          symbol: 'BTCUSDT',
          maxLeverage: 20,
          minLeverage: 1,
          maxPositionValue: 100000,
          minPositionValue: 10
        }
      }
    });

    const calc = new LeverageCalculator();
    const result = await calc.calculateOptimalLeverage('BTCUSDT', 100, 90);
    expect(result.optimalLeverage).toBe(7);
    expect(result.theoreticalMaxLeverage).toBe(10);
    expect(result.exchangeMaxLeverage).toBe(20);
    expect(result.stopLossPercentage).toBeCloseTo(10);
  });

  it('should call axios.post in setLeverage', async () => {
    const axios = require('axios');
    axios.post.mockResolvedValue({});
    const calc = new LeverageCalculator();
    await expect(calc.setLeverage('BTCUSDT', 10)).resolves.toBeUndefined();
    expect(axios.post).toHaveBeenCalled();
  });

  it('should throw error if API fails in calculateOptimalLeverage', async () => {
    const axios = require('axios');
    axios.get.mockRejectedValue(new Error('API error'));
    const calc = new LeverageCalculator();
    await expect(calc.calculateOptimalLeverage('BTCUSDT', 100, 90)).rejects.toThrow('API error');
  });

  it('should throw error if API fails in setLeverage', async () => {
    const axios = require('axios');
    axios.post.mockRejectedValue(new Error('API error'));
    const calc = new LeverageCalculator();
    await expect(calc.setLeverage('BTCUSDT', 10)).rejects.toThrow('API error');
  });
}); 