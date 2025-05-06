import { VolumeAnalyzer, VolumeColor } from '../src/VolumeAnalyzer';

// Helper para mockar volumes e forçar cada cor
function mockVolumes(volumes: number[]) {
  jest.mock('../src/BinanceDataService', () => {
    return {
      BinanceDataService: jest.fn().mockImplementation(() => ({
        getKlineData: jest.fn().mockResolvedValue(
          volumes.map(v => ({ volume: v.toString() }))
        )
      }))
    };
  });
}

describe('VolumeAnalyzer', () => {
  afterEach(() => {
    jest.resetModules(); // Limpa o cache do jest.mock para cada teste
  });

  it('should return RED when stdBar < -0.5', async () => {
    mockVolumes([10, 10, 10, 10, 1]); // Último volume bem abaixo da média
    const { VolumeAnalyzer, VolumeColor } = await import('../src/VolumeAnalyzer');
    const analyzer = new VolumeAnalyzer();
    const result = await analyzer.analyzeVolume('BTCUSDT');
    expect(result.color).toBe(VolumeColor.RED);
  });

  it('should return ORANGE when -0.5 <= stdBar < 1', async () => {
    mockVolumes([10, 10, 10, 10, 9]); // Último volume um pouco abaixo da média
    const { VolumeAnalyzer, VolumeColor } = await import('../src/VolumeAnalyzer');
    const analyzer = new VolumeAnalyzer();
    const result = await analyzer.analyzeVolume('BTCUSDT');
    expect(result.color).toBe(VolumeColor.ORANGE);
  });

  it('should return YELLOW when 1 <= stdBar < 2.5', async () => {
    mockVolumes([10, 10, 10, 10, 15]); // Último volume acima da média, mas não muito
    const { VolumeAnalyzer, VolumeColor } = await import('../src/VolumeAnalyzer');
    const analyzer = new VolumeAnalyzer();
    const result = await analyzer.analyzeVolume('BTCUSDT');
    expect(result.color).toBe(VolumeColor.YELLOW);
  });

  it('should return WHITE when 2.5 <= stdBar < 4', async () => {
    mockVolumes([10, 10, 10, 10, 30]); // Último volume bem acima da média
    const { VolumeAnalyzer, VolumeColor } = await import('../src/VolumeAnalyzer');
    const analyzer = new VolumeAnalyzer();
    const result = await analyzer.analyzeVolume('BTCUSDT');
    expect(result.color).toBe(VolumeColor.WHITE);
  });

  it('should return BLUE when stdBar >= 4', async () => {
    mockVolumes([10, 10, 10, 10, 60]); // Último volume muito acima da média
    const { VolumeAnalyzer, VolumeColor } = await import('../src/VolumeAnalyzer');
    const analyzer = new VolumeAnalyzer();
    const result = await analyzer.analyzeVolume('BTCUSDT');
    expect(result.color).toBe(VolumeColor.BLUE);
  });
}); 