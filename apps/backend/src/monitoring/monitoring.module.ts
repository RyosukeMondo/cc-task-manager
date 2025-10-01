import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { MonitoringService } from './monitoring.service';
import { MonitoringController } from './monitoring.controller';

/**
 * Monitoring Module for system metrics collection
 * Provides real-time system, API, database, and WebSocket metrics
 *
 * Features:
 * - System resource monitoring (CPU, memory, disk)
 * - API performance tracking (response times, throughput)
 * - Database connection pool monitoring
 * - WebSocket connection metrics
 * - REST API endpoint for metrics retrieval
 */
@Module({
  imports: [DatabaseModule],
  controllers: [MonitoringController],
  providers: [MonitoringService],
  exports: [MonitoringService],
})
export class MonitoringModule {}
