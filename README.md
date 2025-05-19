# Trade NB Members

A TypeScript-based trading automation system that integrates with multiple cryptocurrency exchanges (Binance and BingX) to analyze and execute trades(BingX only) based on various market conditions and strategies.

## Features

- Multi-exchange support analyze (Binance and BingX) 
- Automated trade analysis and execution
- Volume analysis and position validation
- Real-time order status monitoring
- Leverage calculation and management
- Console-based chart visualization
- SQLite database for trade history and data persistence
- Cron job scheduling for automated tasks

## Prerequisites

- Node.js (v14 or higher)
- npm or pnpm package manager
- TypeScript
- SQLite3

## Installation

1. Clone the repository:
```bash
git clone [repository-url]
cd trade_nb_members
```

2. Install dependencies:
```bash
npm install
# or
pnpm install
```

3. Create a `.env` file in the root directory with your API credentials:
```env
BINGX_API_KEY=your_bingx_api_key
BINGX_API_SECRET=your_bingx_api_secret
```

## Project Structure

```
├── src/
│   ├── utils/           # Utility functions
│   ├── BingXDataService.ts
│   ├── BinanceDataService.ts
│   ├── ConsoleChartService.ts
│   ├── DataServiceManager.ts
│   ├── LeverageCalculator.ts
│   ├── OrderStatusChecker.ts
│   ├── PositionValidator.ts
│   ├── TradeCronJob.ts
│   ├── TradeDatabase.ts
│   ├── TradeEntryAnalyzer.ts
│   ├── TradeOrderProcessor.ts
│   ├── TradeValidator.ts
│   ├── VolumeAnalyzer.ts
│   └── index.ts
├── tests/              # Test files
├── db/                 # Database files
├── data/              # Data storage
└── package.json
```

## Usage

1. Development mode:
```bash
npm run dev
# or
pnpm dev
```

2. Build the project:
```bash
npm run build
# or
pnpm build
```

3. Run tests:
```bash
npm test
# or
pnpm test
```

## Main Components

- **Data Services**: Integration with Binance and BingX exchanges
- **Trade Analysis**: Volume analysis, position validation, and entry point analysis
- **Order Processing**: Automated order execution and status monitoring (BingX only)
- **Database**: SQLite-based storage for trade history and market data
- **Scheduling**: Cron jobs for automated trading tasks

## Testing

The project uses Jest for testing. Run the test suite with:
```bash
npm test
```

## License

ISC

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Security

- Never commit your API keys or secrets
- Always use environment variables for sensitive data
- Keep your dependencies up to date
- Review and validate all trade operations before execution 