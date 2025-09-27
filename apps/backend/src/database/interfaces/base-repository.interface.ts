/**
 * Base Repository Interface following Repository Pattern
 * Implements Dependency Inversion Principle - depend on abstractions
 * 
 * This interface defines the contract for all repository implementations
 * providing a consistent API for CRUD operations across different entities
 */
export interface IBaseRepository<T, ID = string> {
  /**
   * Create a new entity
   */
  create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T>;

  /**
   * Find entity by ID
   */
  findById(id: ID): Promise<T | null>;

  /**
   * Find multiple entities with optional filtering
   */
  findMany(options?: FindManyOptions<T>): Promise<T[]>;

  /**
   * Find one entity with optional filtering
   */
  findOne(options: FindOneOptions<T>): Promise<T | null>;

  /**
   * Update entity by ID
   */
  update(id: ID, data: Partial<Omit<T, 'id' | 'createdAt'>>): Promise<T>;

  /**
   * Delete entity by ID
   */
  delete(id: ID): Promise<void>;

  /**
   * Count entities with optional filtering
   */
  count(options?: CountOptions<T>): Promise<number>;

  /**
   * Check if entity exists by ID
   */
  exists(id: ID): Promise<boolean>;
}

/**
 * Find many options interface
 */
export interface FindManyOptions<T> {
  where?: Partial<T> | WhereCondition<T>;
  orderBy?: OrderByCondition<T>;
  skip?: number;
  take?: number;
  include?: IncludeOptions<T>;
}

/**
 * Find one options interface
 */
export interface FindOneOptions<T> {
  where: Partial<T> | WhereCondition<T>;
  include?: IncludeOptions<T>;
}

/**
 * Count options interface
 */
export interface CountOptions<T> {
  where?: Partial<T> | WhereCondition<T>;
}

/**
 * Generic where condition type
 */
export type WhereCondition<T> = {
  [K in keyof T]?: T[K] | FilterCondition<T[K]>;
};

/**
 * Filter condition for advanced queries
 */
export interface FilterCondition<T> {
  equals?: T;
  not?: T;
  in?: T[];
  notIn?: T[];
  lt?: T;
  lte?: T;
  gt?: T;
  gte?: T;
  contains?: T;
  startsWith?: T;
  endsWith?: T;
}

/**
 * Order by condition type
 */
export type OrderByCondition<T> = {
  [K in keyof T]?: 'asc' | 'desc';
};

/**
 * Include options for related entities
 */
export type IncludeOptions<T> = {
  [K in keyof T]?: boolean | IncludeOptions<T[K]>;
};