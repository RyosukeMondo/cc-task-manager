# Suggested Commands

## Development Commands
```bash
# Start development server with watch mode
npm run start:dev

# Build the application
npm run build

# Start production server
npm run start:prod
```

## Code Quality Commands
```bash
# Lint TypeScript files
npm run lint

# Format code with Prettier
npm run format
```

## Testing Commands
```bash
# Run unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:cov

# Run integration tests
npm run test:integration

# Run contract tests
npm run test:contract

# Run end-to-end tests
npm run test:e2e
```

## Contract Management
```bash
# Run contract CLI tool
npm run contract

# Examples:
npm run contract validate
npm run contract generate-docs
npm run contract check-compatibility
```

## System Commands
```bash
# List files and directories
ls -la

# Change directory
cd <directory>

# Search for text in files
grep -r "search_term" src/

# Find files by name
find . -name "*.ts" -type f

# Git operations
git status
git add .
git commit -m "message"
git push
```

## Build and Deployment
```bash
# Install dependencies
pnpm install

# Clean build artifacts
rm -rf dist/

# Full rebuild
npm run build
```