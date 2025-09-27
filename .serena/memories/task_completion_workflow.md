# Task Completion Workflow

## When a Task is Completed

### 1. Code Quality Checks
```bash
# Run linting to ensure code style compliance
npm run lint

# Format code if needed
npm run format
```

### 2. Testing Requirements
```bash
# Run all relevant tests
npm run test           # Unit tests
npm run test:integration  # Integration tests
npm run test:contract     # Contract tests if applicable

# Ensure test coverage
npm run test:cov
```

### 3. Build Verification
```bash
# Ensure TypeScript compilation succeeds
npm run build
```

### 4. Contract Validation (if applicable)
```bash
# Validate contracts if working on contract-related features
npm run contract validate
```

### 5. Documentation Updates
- Update relevant documentation in `docs/` if new features added
- Ensure inline code documentation is current
- Update API documentation if endpoints changed

### 6. Git Workflow
```bash
# Check current status
git status

# Add changes
git add .

# Commit with descriptive message
git commit -m "feat: descriptive message about the change"

# Push to remote (if working on feature branch)
git push origin feature-branch-name
```

## Quality Gates
- ✅ All tests pass
- ✅ Linting passes without errors
- ✅ TypeScript compilation succeeds
- ✅ No breaking changes in contracts
- ✅ Documentation updated if needed

## Notes
- Never skip tests to make builds pass
- Always run the full test suite before committing
- Ensure backward compatibility for contract changes
- Follow semantic commit message conventions