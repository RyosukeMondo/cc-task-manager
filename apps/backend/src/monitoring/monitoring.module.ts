import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { MonitoringService } from './monitoring.service';

/**
 * Monitoring Module for system metrics collection
 * Provides real-time system, API, database, and WebSocket metrics
 *
 * Features:
 * - System resource monitoring (CPU, memory, disk)
 * - API performance tracking (response times, throughput)
 * - Database connection pool monitoring
 * - WebSocket connection metrics
 */
@Module({
  imports: [DatabaseModule],
  providers: [MonitoringService],
  exports: [MonitoringService],
})
export class MonitoringModule {}
