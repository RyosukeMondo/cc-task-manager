# Frontend Deployment Guide

## Build Optimization Features

### Next.js Configuration
- **Standalone Output**: Optimized for containerized deployments
- **SWC Minification**: Fast JavaScript/TypeScript compilation
- **Image Optimization**: WebP/AVIF formats with responsive sizes
- **CSS Optimization**: Automatic CSS optimization in production
- **Bundle Analysis**: Webpack bundle analyzer integration
- **Code Splitting**: Optimized chunk splitting for vendors, common code, and contracts
- **Performance Monitoring**: Web Vitals attribution and instrumentation hooks

### Performance Targets
- **First Load JS**: < 250 KB
- **Total Bundle Size**: < 500 KB
- **Core Web Vitals**:
  - LCP (Largest Contentful Paint): < 2.5s
  - FID (First Input Delay): < 100ms
  - CLS (Cumulative Layout Shift): < 0.1

## Build Commands

### Development
```bash
pnpm dev                    # Start development server
pnpm type-check            # TypeScript type checking
pnpm lint                  # ESLint code quality check
```

### Production Build
```bash
pnpm build                 # Standard production build
pnpm build:production      # Production build with optimizations
pnpm build:analyze         # Build with bundle analysis
pnpm start:production      # Start production server
```

### Performance Analysis
```bash
pnpm bundle-analyzer       # Analyze bundle composition
pnpm size-check           # Check bundle size limits
pnpm perf:audit           # Lighthouse performance audit
pnpm perf:measure         # Full performance measurement
```

## Docker Deployment

### Local Development
```bash
# Build production image
pnpm docker:build:prod

# Run production container
pnpm docker:run:prod
```

### Docker Compose
```bash
# Start complete service stack
docker-compose up -d

# View logs
docker-compose logs -f frontend

# Stop services
docker-compose down
```

### Multi-Stage Build Process
1. **Base**: Node.js 18.17 Alpine with pnpm
2. **Dependencies**: Install and cache dependencies
3. **Builder**: Build workspace packages and frontend
4. **Runner**: Production runtime with security optimizations

## Environment Configuration

### Production Variables
Set the following environment variables for production deployment:

```bash
# API Endpoints
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_WS_URL=wss://ws.yourdomain.com
NEXT_PUBLIC_AUTH_URL=https://auth.yourdomain.com

# Performance Monitoring (optional)
NEXT_PUBLIC_ANALYTICS_ID=your-analytics-id
NEXT_PUBLIC_SENTRY_DSN=your-sentry-dsn
```

## Security Features

### Headers
- **X-Frame-Options**: DENY (clickjacking protection)
- **X-Content-Type-Options**: nosniff (MIME sniffing protection)
- **Referrer-Policy**: origin-when-cross-origin
- **X-DNS-Prefetch-Control**: on (performance optimization)

### Static Assets
- **Cache-Control**: Long-term caching (1 year) for immutable assets
- **Compression**: Gzip/Brotli compression enabled
- **Security**: Non-root user execution in container

## Health Monitoring

### Health Check Endpoint
The application includes a health check at `/api/health` that:
- Verifies application responsiveness
- Returns HTTP 200 for healthy state
- Integrated with Docker health checks

### Performance Monitoring
- **Web Vitals**: Real User Monitoring (RUM) data collection
- **Bundle Analysis**: Automated bundle size tracking
- **Size Limits**: CI/CD integration for size regression detection

## Production Deployment Checklist

### Pre-deployment
- [ ] Run `pnpm type-check` (no TypeScript errors)
- [ ] Run `pnpm lint` (no ESLint errors)
- [ ] Run `pnpm test` (all tests passing)
- [ ] Run `pnpm build` (successful build)
- [ ] Run `pnpm size-check` (within size limits)

### Infrastructure
- [ ] Set production environment variables
- [ ] Configure reverse proxy/load balancer
- [ ] Set up SSL/TLS certificates
- [ ] Configure CDN for static assets
- [ ] Set up monitoring and logging

### Post-deployment
- [ ] Verify health check endpoint
- [ ] Run Lighthouse audit
- [ ] Check Web Vitals metrics
- [ ] Validate all functionality
- [ ] Monitor error rates and performance

## Troubleshooting

### Build Issues
- **Memory errors**: Increase Node.js memory limit: `NODE_OPTIONS="--max-old-space-size=4096"`
- **Package resolution**: Clear `.next` cache and `node_modules`
- **Type errors**: Run `pnpm type-check` for detailed error information

### Runtime Issues
- **500 errors**: Check server logs for detailed error information
- **Performance**: Use `pnpm perf:audit` to identify bottlenecks
- **Bundle size**: Use `pnpm bundle-analyzer` to analyze large chunks

### Docker Issues
- **Build failures**: Check Docker daemon status and available disk space
- **Container crashes**: Review container logs with `docker logs <container-id>`
- **Health check failures**: Verify application starts correctly and health endpoint responds