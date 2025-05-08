import { TradeValidator } from '../src/TradeValidator';
import { VolumeColor } from '../src/VolumeAnalyzer';

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
    const mockEntryAnalysis = {
      canEnter: true,
      currentClose: 100,
      hasClosePriceBeforeEntry: true,
      message: 'Entry ok'
    };
    const mockVolumeAnalysis = {
      color: VolumeColor.YELLOW,
      stdBar: 5,
      mean: 10,
      std: 2,
      currentVolume: 20
    };

    mockAnalyzeEntry.mockResolvedValue(mockEntryAnalysis);
    mockAnalyzeVolume.mockResolvedValue(mockVolumeAnalysis);

    const result = await validator.validateTrade({
      symbol: 'BTCUSDT',
      type: 'LONG',
      entry: 100,
      stop: 90,
      volume: true
    });

    expect(result.isValid).toBe(true);
    expect(result.message).toContain('Trade is valid');
    expect(result.entryAnalysis).toEqual(mockEntryAnalysis);
    expect(result.volumeAnalysis).toEqual(mockVolumeAnalysis);
  });

  it('should return valid when entry is valid and volume flag is false', async () => {
    const mockEntryAnalysis = {
      canEnter: true,
      currentClose: 100,
      hasClosePriceBeforeEntry: true,
      message: 'Entry ok'
    };
    const mockVolumeAnalysis = {
      color: VolumeColor.BLUE,
      stdBar: -1,
      mean: 10,
      std: 2,
      currentVolume: 5
    };

    mockAnalyzeEntry.mockResolvedValue(mockEntryAnalysis);
    mockAnalyzeVolume.mockResolvedValue(mockVolumeAnalysis);

    const result = await validator.validateTrade({
      symbol: 'BTCUSDT',
      type: 'LONG',
      entry: 100,
      stop: 90,
      volume: false
    });

    expect(result.isValid).toBe(true);
    expect(result.message).toContain('Trade is valid');
    expect(result.message).toContain('without volume flag');
    expect(result.entryAnalysis).toEqual(mockEntryAnalysis);
    expect(result.volumeAnalysis).toEqual(mockVolumeAnalysis);
  });

  it('should return invalid when entry is invalid', async () => {
    const mockEntryAnalysis = {
      canEnter: false,
      currentClose: 95,
      hasClosePriceBeforeEntry: false,
      message: 'Entry not met'
    };
    const mockVolumeAnalysis = {
      color: VolumeColor.YELLOW,
      stdBar: 5,
      mean: 10,
      std: 2,
      currentVolume: 20
    };

    mockAnalyzeEntry.mockResolvedValue(mockEntryAnalysis);
    mockAnalyzeVolume.mockResolvedValue(mockVolumeAnalysis);

    const result = await validator.validateTrade({
      symbol: 'BTCUSDT',
      type: 'LONG',
      entry: 100,
      stop: 90,
      volume: true
    });

    expect(result.isValid).toBe(false);
    expect(result.message).toContain('Trade is invalid');
    expect(result.message).toContain('Entry not met');
    expect(result.entryAnalysis).toEqual(mockEntryAnalysis);
    expect(result.volumeAnalysis).toEqual(mockVolumeAnalysis);
  });

  it('should return invalid when volume is invalid and volume flag is true', async () => {
    const mockEntryAnalysis = {
      canEnter: true,
      currentClose: 100,
      hasClosePriceBeforeEntry: true,
      message: 'Entry ok'
    };
    const mockVolumeAnalysis = {
      color: VolumeColor.BLUE,
      stdBar: -1,
      mean: 10,
      std: 2,
      currentVolume: 5
    };

    mockAnalyzeEntry.mockResolvedValue(mockEntryAnalysis);
    mockAnalyzeVolume.mockResolvedValue(mockVolumeAnalysis);

    const result = await validator.validateTrade({
      symbol: 'BTCUSDT',
      type: 'LONG',
      entry: 100,
      stop: 90,
      volume: true
    });

    expect(result.isValid).toBe(false);
    expect(result.message).toContain('Trade is invalid');
    expect(result.message).toContain('Volume is not high enough');
    expect(result.entryAnalysis).toEqual(mockEntryAnalysis);
    expect(result.volumeAnalysis).toEqual(mockVolumeAnalysis);
  });

  it('should return invalid when both entry and volume are invalid', async () => {
    const mockEntryAnalysis = {
      canEnter: false,
      currentClose: 95,
      hasClosePriceBeforeEntry: false,
      message: 'Entry not met'
    };
    const mockVolumeAnalysis = {
      color: VolumeColor.BLUE,
      stdBar: -1,
      mean: 10,
      std: 2,
      currentVolume: 5
    };

    mockAnalyzeEntry.mockResolvedValue(mockEntryAnalysis);
    mockAnalyzeVolume.mockResolvedValue(mockVolumeAnalysis);

    const result = await validator.validateTrade({
      symbol: 'BTCUSDT',
      type: 'LONG',
      entry: 100,
      stop: 90,
      volume: true
    });

    expect(result.isValid).toBe(false);
    expect(result.message).toContain('Trade is invalid');
    expect(result.message).toContain('Entry not met');
    expect(result.message).toContain('volume is not high enough');
    expect(result.entryAnalysis).toEqual(mockEntryAnalysis);
    expect(result.volumeAnalysis).toEqual(mockVolumeAnalysis);
  });
}); 