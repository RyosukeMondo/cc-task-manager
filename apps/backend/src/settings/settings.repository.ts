import { Injectable } from '@nestjs/common';
import { Settings, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

/**
 * Settings Repository
 *
 * Data access layer for settings CRUD operations using repository pattern.
 * Implements type-safe database operations without exposing raw Prisma client.
 */
@Injectable()
export class SettingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find settings by user ID
   * @param userId - The user's unique identifier
   * @returns Settings or null if not found
   */
  async findByUserId(userId: string): Promise<Settings | null> {
    return this.prisma.settings.findUnique({
      where: { userId },
    });
  }

  /**
   * Create new settings
   * @param data - Settings creation data
   * @returns Newly created settings
   */
  async create(data: Prisma.SettingsCreateInput): Promise<Settings> {
    return this.prisma.settings.create({
      data,
    });
  }

  /**
   * Update existing settings
   * @param userId - The user's unique identifier
   * @param data - Settings update data
   * @returns Updated settings
   */
  async update(userId: string, data: Prisma.SettingsUpdateInput): Promise<Settings> {
    return this.prisma.settings.update({
      where: { userId },
      data,
    });
  }

  /**
   * Atomic upsert operation - create or update settings
   * @param params - Upsert parameters with where clause, update data, and create data
   * @returns Created or updated settings
   */
  async upsert(params: {
    where: Prisma.SettingsWhereUniqueInput;
    update: Prisma.SettingsUpdateInput;
    create: Prisma.SettingsCreateInput;
  }): Promise<Settings> {
    return this.prisma.settings.upsert(params);
  }
}
