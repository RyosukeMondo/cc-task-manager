import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

/**
 * Analytics Repository
 *
 * Handles database-level aggregation queries for analytics data.
 * Uses Prisma for type-safe queries and raw SQL for complex aggregations.
 */
@Injectable()
export class AnalyticsRepository {
  private readonly logger = new Logger(AnalyticsRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculate performance metrics for a user's tasks
   * @param userId User ID
   * @param startDate Start date for metrics calculation
   * @param endDate End date for metrics calculation
   * @returns Performance metrics
   */
  async calculatePerformanceMetrics(
    userId: string,
    startDate: Date,
    endDate: Date,
  ) {
    this.logger.debug(`Calculating performance metrics for user ${userId} from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    // Count tasks by status using Prisma aggregate
    const taskCounts = await this.prisma.task.groupBy({
      by: ['status'],
      where: {
        assigneeId: userId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      _count: {
        id: true,
      },
    });

    // Calculate task totals
    const totalTasks = taskCounts.reduce((sum, group) => sum + group._count.id, 0);
    const completedTasks = taskCounts.find(g => g.status === 'DONE')?._count.id || 0;
    const failedTasks = taskCounts.find(g => g.status === 'CANCELLED')?._count.id || 0;

    // Calculate completion rate
    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    // Calculate average execution time using raw SQL
    // Execution time = completedAt - createdAt (in seconds)
    const avgExecutionResult = await this.prisma.$queryRaw<Array<{ avg_execution_time: number | null }>>`
      SELECT AVG(EXTRACT(EPOCH FROM (completed_at - created_at)))::float as avg_execution_time
      FROM tasks
      WHERE assignee_id = ${userId}
        AND status = 'DONE'
        AND completed_at IS NOT NULL
        AND created_at >= ${startDate}
        AND created_at <= ${endDate}
    `;

    const averageExecutionTime = avgExecutionResult[0]?.avg_execution_time || null;

    // Calculate throughput (completed tasks per hour)
    const durationMs = endDate.getTime() - startDate.getTime();
    const durationHours = durationMs / (1000 * 60 * 60);
    const throughput = durationHours > 0 ? completedTasks / durationHours : 0;

    return {
      completionRate: Math.round(completionRate * 100) / 100, // Round to 2 decimals
      averageExecutionTime,
      throughput: Math.round(throughput * 100) / 100, // Round to 2 decimals
      totalTasks,
      completedTasks,
      failedTasks,
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
    };
  }

  /**
   * Calculate trend data for a user's tasks
   * @param userId User ID
   * @param groupBy Grouping period (day, week, month)
   * @param startDate Start date for trend calculation
   * @param endDate End date for trend calculation
   * @returns Trend data
   */
  async calculateTrends(
    userId: string,
    groupBy: 'day' | 'week' | 'month',
    startDate: Date,
    endDate: Date,
  ) {
    this.logger.debug(`Calculating trends for user ${userId} grouped by ${groupBy} from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    // Use raw SQL with DATE_TRUNC for time-series grouping
    const trendData = await this.prisma.$queryRaw<Array<{
      period: Date;
      total_tasks: bigint;
      completed_tasks: bigint;
      failed_tasks: bigint;
      avg_execution_time: number | null;
    }>>`
      SELECT
        DATE_TRUNC(${groupBy}, created_at) as period,
        COUNT(*)::bigint as total_tasks,
        COUNT(CASE WHEN status = 'DONE' THEN 1 END)::bigint as completed_tasks,
        COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END)::bigint as failed_tasks,
        AVG(
          CASE
            WHEN status = 'DONE' AND completed_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM (completed_at - created_at))
          END
        )::float as avg_execution_time
      FROM tasks
      WHERE assignee_id = ${userId}
        AND created_at >= ${startDate}
        AND created_at <= ${endDate}
      GROUP BY DATE_TRUNC(${groupBy}, created_at)
      ORDER BY period ASC
    `;

    // Transform the result to match the expected schema
    return trendData.map(row => ({
      period: row.period.toISOString(),
      totalTasks: Number(row.total_tasks),
      completedTasks: Number(row.completed_tasks),
      failedTasks: Number(row.failed_tasks),
      averageExecutionTime: row.avg_execution_time,
    }));
  }
}
