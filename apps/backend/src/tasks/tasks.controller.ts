import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UsePipes,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ContractValidationPipe } from '../../../../src/contracts/ContractValidationPipe';
import {
  TaskBase,
  CreateTask,
  UpdateTask,
  TaskQueryFilters,
  TaskStatistics,
  BulkTaskOperation,
  validateCreateTask,
  validateUpdateTask,
  validateTaskQueryFilters,
  validateBulkTaskOperation,
} from '../schemas/task.schemas';
import { JWTPayload } from '../schemas/auth.schemas';

/**
 * Task Management Controller following Single Responsibility Principle
 * Responsible only for handling HTTP requests and responses for task operations
 * Leverages existing ContractValidationPipe for request validation
 */
@ApiTags('Tasks')
@Controller('tasks')
@UseGuards(JwtAuthGuard) // All endpoints require authentication
@ApiBearerAuth()
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  /**
   * Create a new task
   * Uses Zod validation for request body validation
   */
  @Post()
  @ApiOperation({ summary: 'Create a new task' })
  @ApiResponse({
    status: 201,
    description: 'Task created successfully',
    type: 'object',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid task data',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized access',
  })
  async createTask(
    @Body() createTaskData: CreateTask,
    @CurrentUser() user: JWTPayload,
  ): Promise<TaskBase> {
    // Validate using Zod schema
    const validatedData = validateCreateTask(createTaskData);
    return this.tasksService.createTask(validatedData, user.sub);
  }

  /**
   * Get all tasks with optional filtering
   * Uses Zod validation for query parameters
   */
  @Get()
  @ApiOperation({ summary: 'Get all tasks with optional filtering' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by task status' })
  @ApiQuery({ name: 'priority', required: false, description: 'Filter by task priority' })
  @ApiQuery({ name: 'category', required: false, description: 'Filter by task category' })
  @ApiQuery({ name: 'assigneeId', required: false, description: 'Filter by assignee ID' })
  @ApiQuery({ name: 'projectId', required: false, description: 'Filter by project ID' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number for pagination' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of items per page' })
  @ApiResponse({
    status: 200,
    description: 'Tasks retrieved successfully',
    type: 'object',
  })
  async getAllTasks(
    @Query() queryFilters: any,
  ): Promise<{ tasks: TaskBase[]; total: number; page: number; limit: number }> {
    // Validate query parameters using Zod
    const filters = validateTaskQueryFilters(queryFilters);
    return this.tasksService.getAllTasks(filters);
  }

  /**
   * Get a specific task by ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get a task by ID' })
  @ApiParam({ name: 'id', description: 'Task UUID' })
  @ApiResponse({
    status: 200,
    description: 'Task retrieved successfully',
    type: 'object',
  })
  @ApiResponse({
    status: 404,
    description: 'Task not found',
  })
  async getTaskById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TaskBase> {
    return this.tasksService.getTaskById(id);
  }

  /**
   * Update a task
   * Uses Zod validation for request body validation
   */
  @Patch(':id')
  @ApiOperation({ summary: 'Update a task' })
  @ApiParam({ name: 'id', description: 'Task UUID' })
  @ApiResponse({
    status: 200,
    description: 'Task updated successfully',
    type: 'object',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid task data',
  })
  @ApiResponse({
    status: 404,
    description: 'Task not found',
  })
  async updateTask(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTaskData: UpdateTask,
    @CurrentUser() user: JWTPayload,
  ): Promise<TaskBase> {
    // Validate update data using Zod
    const updateData = validateUpdateTask(updateTaskData);
    return this.tasksService.updateTask(id, updateData, user.sub);
  }

  /**
   * Delete a task
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a task' })
  @ApiParam({ name: 'id', description: 'Task UUID' })
  @ApiResponse({
    status: 204,
    description: 'Task deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Task not found',
  })
  async deleteTask(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JWTPayload,
  ): Promise<void> {
    await this.tasksService.deleteTask(id, user.sub);
  }

  /**
   * Get tasks by assignee ID
   */
  @Get('assignee/:assigneeId')
  @ApiOperation({ summary: 'Get tasks by assignee' })
  @ApiParam({ name: 'assigneeId', description: 'Assignee user UUID' })
  @ApiResponse({
    status: 200,
    description: 'Assignee tasks retrieved successfully',
  })
  async getTasksByAssignee(
    @Param('assigneeId', ParseUUIDPipe) assigneeId: string,
  ): Promise<TaskBase[]> {
    return this.tasksService.getTasksByAssignee(assigneeId);
  }

  /**
   * Get tasks by project ID
   */
  @Get('project/:projectId')
  @ApiOperation({ summary: 'Get tasks by project' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiResponse({
    status: 200,
    description: 'Project tasks retrieved successfully',
  })
  async getTasksByProject(
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ): Promise<TaskBase[]> {
    return this.tasksService.getTasksByProject(projectId);
  }

  /**
   * Get overdue tasks
   */
  @Get('status/overdue')
  @ApiOperation({ summary: 'Get overdue tasks' })
  @ApiResponse({
    status: 200,
    description: 'Overdue tasks retrieved successfully',
  })
  async getOverdueTasks(): Promise<TaskBase[]> {
    return this.tasksService.getOverdueTasks();
  }

  /**
   * Get task statistics
   */
  @Get('statistics/overview')
  @ApiOperation({ summary: 'Get task statistics overview' })
  @ApiResponse({
    status: 200,
    description: 'Task statistics retrieved successfully',
    type: 'object',
  })
  async getTaskStatistics(): Promise<TaskStatistics> {
    return this.tasksService.getTaskStatistics();
  }

  /**
   * Bulk task operations
   */
  @Post('bulk')
  @ApiOperation({ summary: 'Perform bulk operations on tasks' })
  @ApiResponse({
    status: 200,
    description: 'Bulk operation completed successfully',
    type: 'object',
  })
  async bulkTaskOperation(
    @Body() operationData: BulkTaskOperation,
    @CurrentUser() user: JWTPayload,
  ): Promise<{ success: boolean; affectedTasks: number; results: TaskBase[] }> {
    // Validate bulk operation data using Zod
    const operation = validateBulkTaskOperation(operationData);
    return this.tasksService.bulkOperation(operation, user.sub);
  }
}