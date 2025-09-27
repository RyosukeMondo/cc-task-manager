import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

/**
 * Prisma Service for database connection management
 * Implements proper lifecycle management and connection handling
 * Following Single Responsibility Principle - focused on database connectivity
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(private configService: ConfigService) {
    super({
      datasources: {
        db: {
          url: configService.get<string>('DATABASE_URL'),
        },
      },
      log: [
        {
          emit: 'event',
          level: 'query',
        },
        {
          emit: 'event',
          level: 'error',
        },
        {
          emit: 'event',
          level: 'info',
        },
        {
          emit: 'event',
          level: 'warn',
        },
      ],
      errorFormat: 'colored',
    });

    // Set up Prisma event logging
    this.setupEventLogging();
  }

  /**
   * Initialize Prisma connection on module init
   */
  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('Successfully connected to database');
      
      // Test database connection
      await this.testConnection();
    } catch (error) {
      this.logger.error('Failed to connect to database', {
        error: error.message,
        databaseUrl: this.maskDatabaseUrl(),
      });
      throw error;
    }
  }

  /**
   * Clean up Prisma connection on module destroy
   */
  async onModuleDestroy(): Promise<void> {
    try {
      await this.$disconnect();
      this.logger.log('Successfully disconnected from database');
    } catch (error) {
      this.logger.error('Error disconnecting from database', {
        error: error.message,
      });
    }
  }

  /**
   * Test database connection with a simple query
   */
  private async testConnection(): Promise<void> {
    try {
      await this.$queryRaw`SELECT 1`;
      this.logger.log('Database connection test successful');
    } catch (error) {
      this.logger.error('Database connection test failed', {
        error: error.message,
      });
      throw new Error('Database connection test failed');
    }
  }

  /**
   * Set up Prisma event logging for monitoring
   */
  private setupEventLogging(): void {
    // Log slow queries in development
    if (process.env.NODE_ENV !== 'production') {
      this.$on('query', (e) => {
        if (e.duration > 1000) { // Log queries taking more than 1 second
          this.logger.warn('Slow query detected', {
            query: e.query,
            duration: `${e.duration}ms`,
            params: e.params,
          });
        } else {
          this.logger.debug('Query executed', {
            query: e.query,
            duration: `${e.duration}ms`,
          });
        }
      });
    }

    // Log errors
    this.$on('error', (e) => {
      this.logger.error('Prisma error', {
        message: e.message,
        target: e.target,
      });
    });

    // Log info messages
    this.$on('info', (e) => {
      this.logger.log('Prisma info', {
        message: e.message,
        target: e.target,
      });
    });

    // Log warnings
    this.$on('warn', (e) => {
      this.logger.warn('Prisma warning', {
        message: e.message,
        target: e.target,
      });
    });
  }

  /**
   * Mask sensitive information in database URL for logging
   */
  private maskDatabaseUrl(): string {
    const url = this.configService.get<string>('DATABASE_URL', '');
    
    try {
      const urlObj = new URL(url);
      if (urlObj.password) {
        urlObj.password = '***';
      }
      return urlObj.toString();
    } catch {
      return 'Invalid URL';
    }
  }

  /**
   * Execute a transaction with proper error handling
   */
  async executeTransaction<T>(fn: (prisma: PrismaClient) => Promise<T>): Promise<T> {
    try {
      this.logger.debug('Starting database transaction');
      
      const result = await this.$transaction(async (prisma) => {
        return await fn(prisma);
      });
      
      this.logger.debug('Database transaction completed successfully');
      return result;
    } catch (error) {
      this.logger.error('Database transaction failed', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Health check method for monitoring
   */
  async healthCheck(): Promise<{ status: string; timestamp: Date }> {
    try {
      await this.$queryRaw`SELECT 1`;
      return {
        status: 'healthy',
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error('Database health check failed', {
        error: error.message,
      });
      throw new Error('Database health check failed');
    }
  }

  /**
   * Get database connection statistics
   */
  async getConnectionStats(): Promise<{
    activeConnections: number;
    maxConnections: number;
    timestamp: Date;
  }> {
    try {
      // Query PostgreSQL specific connection stats
      const result = await this.$queryRaw<Array<{ count: number }>>`
        SELECT count(*) as count FROM pg_stat_activity WHERE state = 'active';
      `;
      
      const maxResult = await this.$queryRaw<Array<{ setting: string }>>`
        SHOW max_connections;
      `;
      
      return {
        activeConnections: Number(result[0]?.count || 0),
        maxConnections: Number(maxResult[0]?.setting || 0),
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.warn('Failed to get connection stats', {
        error: error.message,
      });
      
      return {
        activeConnections: 0,
        maxConnections: 0,
        timestamp: new Date(),
      };
    }
  }
}