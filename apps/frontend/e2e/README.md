# E2E Testing with Playwright

## Quick Start

```bash
# Install (first time only)
pnpm add -D @playwright/test
pnpm exec playwright install chromium

# Run smoke tests (validates all pages load)
pnpm test:e2e:smoke

# Interactive UI mode (recommended)
pnpm test:e2e:ui
```

## What This Solves

**Problem:** Manual "try access → got error → fix → repeat" loop

**Solution:** Automated tests catch errors across all pages in 30 seconds

```
Before: Visit each page manually in browser
After:  pnpm test:e2e:smoke (tests 7 pages automatically)
```

## Commands

- `pnpm test:e2e:smoke` - Quick smoke test all pages
- `pnpm test:e2e:ui` - Visual debugging (recommended)
- `pnpm test:e2e:headed` - Watch tests run in browser
- `pnpm test:e2e:debug` - Step-through debugging
- `./e2e/watch-and-test.sh` - Auto-run on file changes

## What Gets Tested

✅ All pages load without errors
✅ No runtime errors or console errors  
✅ WebSocket connections work
✅ Key elements render

Pages covered:
- Dashboard, Tasks (all/active/completed)
- Analytics (performance/trends), Settings

See `e2e/smoke.spec.ts` for test details.
