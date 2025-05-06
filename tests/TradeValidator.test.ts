import { TradeValidator } from '../src/TradeValidator';

// Mock das dependências
jest.mock('../src/TradeEntryAnalyzer', () => {
  return {
    TradeEntryAnalyzer: jest.fn().mockImplementation(() => ({
      analyzeEntry: jest.fn()
    }))
  };
});

jest.mock('../src/VolumeAnalyzer', () => {
  return {
    VolumeAnalyzer: jest.fn().mockImplementation(() => ({
      analyzeVolume: jest.fn()
    }))
  };
});

describe('TradeValidator', () => {
  let validator: TradeValidator;
  let mockAnalyzeEntry: jest.Mock;
  let mockAnalyzeVolume: jest.Mock;

  beforeEach(() => {
    // Limpa mocks e instancia o validator
    jest.clearAllMocks();
    validator = new TradeValidator();

    // Recupera os mocks das instâncias
    const TradeEntryAnalyzer = require('../src/TradeEntryAnalyzer').TradeEntryAnalyzer;
    const VolumeAnalyzer = require('../src/VolumeAnalyzer').VolumeAnalyzer;
    mockAnalyzeEntry = TradeEntryAnalyzer.mock.instances[0].analyzeEntry;
    mockAnalyzeVolume = VolumeAnalyzer.mock.instances[0].analyzeVolume;
  });

  it('should return valid when both entry and volume are valid', async () => {
    mockAnalyzeEntry.mockResolvedValue({
      canEnter: true,
      currentClose: 100,
      hasPriceInRange: false,
      message: 'Entry ok'
    });
    mockAnalyzeVolume.mockResolvedValue({
      color: 'blue',
      stdBar: 5,
      mean: 10,
      std: 2,
      currentVolume: 20
    });

    const result = await validator.validateTrade({
      symbol: 'BTCUSDT',
      type: 'LONG',
      entry: 100,
      stop: 90
    });

    expect(result.isValid).toBe(true);
    expect(result.message).toContain('Trade is valid');
  });

  it('should return invalid when entry is invalid', async () => {
    mockAnalyzeEntry.mockResolvedValue({
      canEnter: false,
      currentClose: 95,
      hasPriceInRange: false,
      message: 'Entry not met'
    });
    mockAnalyzeVolume.mockResolvedValue({
      color: 'blue',
      stdBar: 5,
      mean: 10,
      std: 2,
      currentVolume: 20
    });

    const result = await validator.validateTrade({
      symbol: 'BTCUSDT',
      type: 'LONG',
      entry: 100,
      stop: 90
    });

    expect(result.isValid).toBe(false);
    expect(result.message).toContain('Trade is invalid');
    expect(result.message).toContain('Entry not met');
  });

  it('should return invalid when volume is invalid', async () => {
    mockAnalyzeEntry.mockResolvedValue({
      canEnter: true,
      currentClose: 100,
      hasPriceInRange: false,
      message: 'Entry ok'
    });
    mockAnalyzeVolume.mockResolvedValue({
      color: 'red',
      stdBar: -1,
      mean: 10,
      std: 2,
      currentVolume: 5
    });

    const result = await validator.validateTrade({
      symbol: 'BTCUSDT',
      type: 'LONG',
      entry: 100,
      stop: 90
    });

    expect(result.isValid).toBe(false);
    expect(result.message).toContain('Trade is invalid');
    expect(result.message).toContain('Volume is not high enough');
  });

  it('should return invalid when both entry and volume are invalid', async () => {
    mockAnalyzeEntry.mockResolvedValue({
      canEnter: false,
      currentClose: 95,
      hasPriceInRange: false,
      message: 'Entry not met'
    });
    mockAnalyzeVolume.mockResolvedValue({
      color: 'red',
      stdBar: -1,
      mean: 10,
      std: 2,
      currentVolume: 5
    });

    const result = await validator.validateTrade({
      symbol: 'BTCUSDT',
      type: 'LONG',
      entry: 100,
      stop: 90
    });

    expect(result.isValid).toBe(false);
    expect(result.message).toContain('Trade is invalid');
    expect(result.message).toContain('Entry not met');
    expect(result.message).toContain('volume is not high enough');
  });
}); 