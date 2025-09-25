# Technology Stack

## Project Type
Modern full-stack web application with AI integration capabilities, featuring real-time task management, background job processing, and sophisticated monitoring dashboards. The system consists of a React-based frontend, NestJS backend API, and Python-wrapped Claude Code SDK integration.

## Core Technologies

### Primary Language(s)
- **Frontend Language**: TypeScript 5.0+ with strict mode enabled for maximum type safety
- **Backend Language**: TypeScript 5.0+ with Node.js 18+ runtime for unified development experience
- **Integration Layer**: Python 3.11+ for Claude Code SDK wrapper execution
- **Runtime**: Node.js 18+ with PM2 process manager for production deployment
- **Language-specific tools**: npm/yarn for package management, tsx for development execution, esbuild for fast compilation

### Key Dependencies/Libraries

**Frontend Stack:**
- **Next.js 14+**: React framework with App Router for server-side rendering and full-stack capabilities
- **React 18+**: UI library with Server Components (RSC) support for optimal performance
- **Shadcn/ui**: Component library providing code ownership and full customization control
- **Tailwind CSS**: Utility-first CSS framework optimized for AI code generation and rapid development
- **TanStack Query**: Server state management with caching, synchronization, and background refetching
- **Zustand**: Lightweight client state management for global UI state

**Backend Stack:**
- **NestJS 10+**: Structured TypeScript framework with dependency injection and modular architecture
- **Prisma**: Type-safe ORM with schema-first approach and excellent developer experience
- **BullMQ**: Robust job queue system with Redis backend for reliable task processing
- **Socket.IO**: Real-time WebSocket communication via NestJS Gateway for live updates
- **Zod**: Schema validation library serving as single source of truth for types and validation
- **Passport.js + JWT**: Authentication system with JSON Web Token support

**Infrastructure & DevOps:**
- **PostgreSQL**: Primary database for ACID compliance and data integrity
- **Redis**: Job queue backend and session storage with high-performance caching
- **PM2**: Process management with automatic restart, clustering, and monitoring capabilities
- **Docker**: Containerization with multi-stage builds for optimized production images

### Application Architecture
**Hybrid Architecture**: Combines server-side rendering with client-side interactivity using a microservices-inspired approach:

1. **Frontend Layer**: Next.js with App Router providing SSR/SSG capabilities and React Server Components
2. **API Gateway**: NestJS REST API with WebSocket gateway for real-time communications
3. **Background Processing**: Separate Node.js worker processes managed by PM2 for Claude Code task execution
4. **Job Orchestration**: BullMQ-powered queue system ensuring reliable task scheduling and retry mechanisms
5. **Data Layer**: PostgreSQL with Prisma ORM providing type-safe database operations

### Data Storage
- **Primary Storage**: PostgreSQL 14+ with JSONB support for flexible data structures and strong consistency
- **Caching**: Redis 7+ for session storage, job queue persistence, and real-time data caching
- **Data Formats**: JSON for API communication, structured logging with JSON output, TypeScript interfaces for type safety
- **File Storage**: Local filesystem for Claude Code session logs with planned cloud storage migration

### External Integrations
- **AI Integration**: Claude Code SDK via Python wrapper for intelligent task execution
- **Protocols**: HTTP/REST for standard operations, WebSocket for real-time updates, child_process.spawn for secure external process execution
- **Authentication**: JWT-based stateless authentication with Passport.js strategies
- **API Documentation**: OpenAPI 3.0 specification auto-generated from Zod schemas

### Monitoring & Dashboard Technologies
- **Dashboard Framework**: Next.js with React Server Components and Tailwind CSS for responsive, real-time interfaces
- **Real-time Communication**: Socket.IO WebSockets with room-based targeting and automatic reconnection
- **State Management**: TanStack Query for server state caching, Zustand for client-side UI state
- **Progress Tracking**: Structured JSON streaming from Python processes parsed in real-time

## Development Environment

### Build & Development Tools
- **Frontend Build**: Next.js built-in bundler with Turbopack for fast development and optimized production builds
- **Backend Build**: tsx for development, tsc for production TypeScript compilation
- **Package Management**: npm with lockfile for reproducible builds and dependency management
- **Development Workflow**: Hot reload via Next.js dev server, nodemon for backend development, concurrent processes for full-stack development

### Code Quality Tools
- **Static Analysis**: ESLint with TypeScript rules, Prettier for consistent formatting, TypeScript strict mode for maximum type safety
- **Formatting**: Prettier with Tailwind CSS plugin for consistent code style across team
- **Testing Framework**: Jest for unit testing, Playwright for end-to-end testing, supertest for API testing
- **Documentation**: TypeDoc for API documentation, OpenAPI auto-generation from Zod schemas

### Version Control & Collaboration
- **VCS**: Git with conventional commits for consistent history and automated changelog generation
- **Branching Strategy**: GitHub Flow with feature branches, pull request reviews, and main branch protection
- **Code Review Process**: Required peer review via GitHub pull requests with automated CI checks

### Dashboard Development
- **Live Reload**: Next.js hot module replacement with fast refresh for instant development feedback
- **Port Management**: Configurable via environment variables with development defaults (3000 frontend, 3001 backend)
- **Multi-Instance Support**: Docker Compose orchestration for running complete development stack locally

## Deployment & Distribution
- **Target Platforms**: Linux-based VPS servers, cloud platforms (AWS, GCP, Azure), Docker-compatible environments
- **Distribution Method**: Docker containers with multi-stage builds, Docker Compose for orchestration, CI/CD pipelines for automated deployment
- **Installation Requirements**: Docker and Docker Compose, minimum 2GB RAM, Node.js 18+ for direct installation
- **Update Mechanism**: Blue-green deployment via Docker container updates with automatic rollback capabilities

## Technical Requirements & Constraints

### Performance Requirements
- **API Response Time**: < 200ms for 95th percentile requests with database query optimization
- **Real-time Updates**: < 100ms WebSocket message delivery for task status changes
- **Memory Usage**: < 512MB per process under normal load with efficient garbage collection
- **Task Processing**: Support for 50+ concurrent Claude Code tasks with resource isolation

### Compatibility Requirements
- **Platform Support**: Linux (Ubuntu 20.04+), macOS (development), Windows via WSL2
- **Node.js Versions**: 18+ with ES2022 support and native WebAssembly compatibility
- **Browser Support**: Modern browsers with ES2020 and WebSocket support (Chrome 90+, Firefox 88+, Safari 14+)
- **Database Compatibility**: PostgreSQL 14+ with JSONB and advanced indexing features

### Security & Compliance
- **Authentication**: JWT-based stateless authentication with secure token handling and refresh mechanisms
- **Input Validation**: Zod schema validation at API boundaries with SQL injection prevention via Prisma
- **Process Isolation**: Secure child_process.spawn execution preventing command injection vulnerabilities
- **Data Protection**: Environment variable secrets management, HTTPS enforcement, CORS configuration

### Scalability & Reliability
- **Expected Load**: 100+ concurrent users, 1000+ tasks per hour with horizontal scaling capability
- **Availability Requirements**: 99.9% uptime with automatic failover and health monitoring
- **Growth Projections**: Horizontal scaling via container orchestration, database read replicas for query scaling

## Technical Decisions & Rationale

### Decision Log

1. **Next.js App Router over Pages Router**: Chosen for React Server Components support, improved performance through server-side rendering, and better developer experience with file-based routing. Alternative considered: Create React App with separate backend, rejected due to additional complexity and deployment overhead.

2. **Prisma over Drizzle ORM**: Selected for superior developer experience, automatic schema migrations, and Prisma Studio debugging capabilities. Drizzle ORM considered for performance benefits but rejected due to steeper learning curve and fewer ecosystem integrations for rapid development.

3. **BullMQ over native child_process**: Chosen for persistent job storage, automatic retry mechanisms, and distributed processing capabilities. Native approach considered but rejected due to lack of reliability features required for production systems.

4. **Zod over class-validator**: Selected for schema-first approach creating single source of truth for types and validation, plus seamless OpenAPI integration. class-validator considered but rejected due to duplication between validation decorators and API documentation requirements.

5. **TanStack Query + Zustand over Redux**: Chosen for clear separation between server and client state, reduced boilerplate, and excellent caching mechanisms. Redux Toolkit considered but rejected due to complexity overhead for project scope and team size.

6. **Python SDK Wrapper over Direct CLI**: Selected for structured data exchange, better error handling, and leveraging full SDK capabilities. Direct CLI execution considered but rejected due to limited communication capabilities and parsing complexity.

## Known Limitations

- **Single Database Instance**: Current architecture uses single PostgreSQL instance; planned migration to read replicas for improved query performance and fault tolerance
- **Local File Storage**: Claude Code session logs stored locally; migration to cloud storage planned for better durability and multi-instance support
- **Memory-based Connection Management**: WebSocket connections managed in application memory; Redis-backed connection store planned for multi-instance deployments
- **Manual Scaling**: Current deployment requires manual container scaling; automatic scaling based on queue depth planned for future iterations