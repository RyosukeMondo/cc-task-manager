import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

describe('Backend API E2E Tests', () => {
  let app: INestApplication;
  let databaseService: PrismaService;
  let jwtService: JwtService;
  let authToken: string;
  let testUserId: string;
  let testTaskId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply global pipes and filters
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }));

    await app.init();

    databaseService = app.get<PrismaService>(PrismaService);
    jwtService = app.get<JwtService>(JwtService);

    // Clean database before tests
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await app.close();
  });

  async function cleanDatabase() {
    // Clean up test data
    await databaseService.task.deleteMany({});
    await databaseService.user.deleteMany({
      email: { contains: 'e2e-test' },
    });
  }

  describe('Authentication Flow', () => {
    const testUser = {
      email: 'e2e-test@example.com',
      password: 'Test123!@#',
      name: 'E2E Test User',
    };

    describe('POST /api/auth/register', () => {
      it('should register a new user', async () => {
        const response = await request(app.getHttpServer())
          .post('/api/auth/register')
          .send(testUser)
          .expect(201);

        expect(response.body).toHaveProperty('access_token');
        expect(response.body.user).toMatchObject({
          email: testUser.email,
          name: testUser.name,
          role: 'user',
        });

        testUserId = response.body.user.id;
        authToken = response.body.access_token;
      });

      it('should reject duplicate email registration', async () => {
        const response = await request(app.getHttpServer())
          .post('/api/auth/register')
          .send(testUser)
          .expect(409);

        expect(response.body.message).toContain('already exists');
      });

      it('should validate registration input', async () => {
        const response = await request(app.getHttpServer())
          .post('/api/auth/register')
          .send({
            email: 'invalid-email',
            password: '123', // Too short
            name: '',
          })
          .expect(400);

        expect(response.body.message).toBeInstanceOf(Array);
        expect(response.body.message).toContain(
          expect.stringContaining('email')
        );
      });
    });

    describe('POST /api/auth/login', () => {
      it('should login with valid credentials', async () => {
        const response = await request(app.getHttpServer())
          .post('/api/auth/login')
          .send({
            email: testUser.email,
            password: testUser.password,
          })
          .expect(200);

        expect(response.body).toHaveProperty('access_token');
        expect(response.body.user.email).toBe(testUser.email);
      });

      it('should reject invalid credentials', async () => {
        await request(app.getHttpServer())
          .post('/api/auth/login')
          .send({
            email: testUser.email,
            password: 'wrong-password',
          })
          .expect(401);
      });

      it('should reject non-existent user', async () => {
        await request(app.getHttpServer())
          .post('/api/auth/login')
          .send({
            email: 'nonexistent@example.com',
            password: 'password',
          })
          .expect(401);
      });
    });

    describe('POST /api/auth/refresh', () => {
      it('should refresh access token', async () => {
        const response = await request(app.getHttpServer())
          .post('/api/auth/refresh')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('access_token');
        expect(response.body.access_token).not.toBe(authToken);
      });

      it('should reject invalid token', async () => {
        await request(app.getHttpServer())
          .post('/api/auth/refresh')
          .set('Authorization', 'Bearer invalid.token')
          .expect(401);
      });
    });

    describe('GET /api/auth/me', () => {
      it('should return current user profile', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/auth/me')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          id: testUserId,
          email: testUser.email,
          name: testUser.name,
        });
      });

      it('should reject unauthenticated request', async () => {
        await request(app.getHttpServer())
          .get('/api/auth/me')
          .expect(401);
      });
    });
  });

  describe('Task Management', () => {
    const testTask = {
      title: 'E2E Test Task',
      description: 'This is an E2E test task',
      priority: 'high',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      tags: ['e2e', 'test'],
    };

    describe('POST /api/tasks', () => {
      it('should create a new task', async () => {
        const response = await request(app.getHttpServer())
          .post('/api/tasks')
          .set('Authorization', `Bearer ${authToken}`)
          .send(testTask)
          .expect(201);

        expect(response.body).toMatchObject({
          title: testTask.title,
          description: testTask.description,
          priority: testTask.priority,
          status: 'pending',
          createdBy: testUserId,
        });

        testTaskId = response.body.id;
      });

      it('should validate task input', async () => {
        const response = await request(app.getHttpServer())
          .post('/api/tasks')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            // Missing title
            description: 'Invalid task',
          })
          .expect(400);

        expect(response.body.message).toContain('title');
      });

      it('should require authentication', async () => {
        await request(app.getHttpServer())
          .post('/api/tasks')
          .send(testTask)
          .expect(401);
      });
    });

    describe('GET /api/tasks', () => {
      it('should list tasks with pagination', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/tasks')
          .set('Authorization', `Bearer ${authToken}`)
          .query({ page: 1, limit: 10 })
          .expect(200);

        expect(response.body).toHaveProperty('data');
        expect(response.body).toHaveProperty('total');
        expect(response.body).toHaveProperty('page', 1);
        expect(response.body).toHaveProperty('limit', 10);
        expect(Array.isArray(response.body.data)).toBe(true);
      });

      it('should filter tasks by status', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/tasks')
          .set('Authorization', `Bearer ${authToken}`)
          .query({ status: 'pending' })
          .expect(200);

        response.body.data.forEach((task: any) => {
          expect(task.status).toBe('pending');
        });
      });

      it('should filter tasks by assignee', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/tasks')
          .set('Authorization', `Bearer ${authToken}`)
          .query({ assigneeId: testUserId })
          .expect(200);

        response.body.data.forEach((task: any) => {
          expect(task.assigneeId).toBe(testUserId);
        });
      });

      it('should search tasks by query', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/tasks/search')
          .set('Authorization', `Bearer ${authToken}`)
          .query({ q: 'E2E' })
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        response.body.forEach((task: any) => {
          const matchesTitle = task.title.toLowerCase().includes('e2e');
          const matchesDescription = task.description?.toLowerCase().includes('e2e');
          expect(matchesTitle || matchesDescription).toBe(true);
        });
      });
    });

    describe('GET /api/tasks/:id', () => {
      it('should get task by id', async () => {
        const response = await request(app.getHttpServer())
          .get(`/api/tasks/${testTaskId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          id: testTaskId,
          title: testTask.title,
        });
      });

      it('should return 404 for non-existent task', async () => {
        await request(app.getHttpServer())
          .get('/api/tasks/non-existent-id')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404);
      });
    });

    describe('PUT /api/tasks/:id', () => {
      it('should update task', async () => {
        const updateData = {
          title: 'Updated E2E Task',
          status: 'in_progress',
        };

        const response = await request(app.getHttpServer())
          .put(`/api/tasks/${testTaskId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(updateData)
          .expect(200);

        expect(response.body).toMatchObject(updateData);
      });

      it('should validate update permissions', async () => {
        // Create another user
        const otherUser = await request(app.getHttpServer())
          .post('/api/auth/register')
          .send({
            email: 'e2e-test-other@example.com',
            password: 'Test123!@#',
            name: 'Other User',
          });

        const otherToken = otherUser.body.access_token;

        // Try to update task created by different user
        await request(app.getHttpServer())
          .put(`/api/tasks/${testTaskId}`)
          .set('Authorization', `Bearer ${otherToken}`)
          .send({ title: 'Unauthorized Update' })
          .expect(403);
      });
    });

    describe('PATCH /api/tasks/:id/status', () => {
      it('should update task status', async () => {
        const response = await request(app.getHttpServer())
          .patch(`/api/tasks/${testTaskId}/status`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ status: 'completed' })
          .expect(200);

        expect(response.body.status).toBe('completed');
      });

      it('should validate status transition', async () => {
        // Try to move completed task back to pending
        await request(app.getHttpServer())
          .patch(`/api/tasks/${testTaskId}/status`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ status: 'pending' })
          .expect(400);
      });
    });

    describe('POST /api/tasks/:id/assign', () => {
      it('should assign task to user', async () => {
        const response = await request(app.getHttpServer())
          .post(`/api/tasks/${testTaskId}/assign`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ assigneeId: testUserId })
          .expect(200);

        expect(response.body.assigneeId).toBe(testUserId);
      });

      it('should validate assignee exists', async () => {
        await request(app.getHttpServer())
          .post(`/api/tasks/${testTaskId}/assign`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ assigneeId: 'non-existent-user' })
          .expect(404);
      });
    });

    describe('DELETE /api/tasks/:id', () => {
      it('should delete task', async () => {
        await request(app.getHttpServer())
          .delete(`/api/tasks/${testTaskId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(204);

        // Verify task is deleted
        await request(app.getHttpServer())
          .get(`/api/tasks/${testTaskId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404);
      });
    });
  });

  describe('User Management', () => {
    describe('GET /api/users', () => {
      it('should require admin role to list users', async () => {
        // Regular user should be forbidden
        await request(app.getHttpServer())
          .get('/api/users')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(403);
      });
    });

    describe('GET /api/users/:id', () => {
      it('should get user profile', async () => {
        const response = await request(app.getHttpServer())
          .get(`/api/users/${testUserId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          id: testUserId,
          email: 'e2e-test@example.com',
        });
        expect(response.body).not.toHaveProperty('password');
      });

      it('should restrict access to other user profiles', async () => {
        // Create another user
        const otherUser = await request(app.getHttpServer())
          .post('/api/auth/register')
          .send({
            email: 'e2e-test-private@example.com',
            password: 'Test123!@#',
            name: 'Private User',
          });

        // Regular user cannot view other profiles
        await request(app.getHttpServer())
          .get(`/api/users/${otherUser.body.user.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(403);
      });
    });

    describe('PUT /api/users/:id', () => {
      it('should update own profile', async () => {
        const updateData = {
          name: 'Updated E2E User',
        };

        const response = await request(app.getHttpServer())
          .put(`/api/users/${testUserId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(updateData)
          .expect(200);

        expect(response.body.name).toBe(updateData.name);
      });

      it('should not allow updating other user profiles', async () => {
        await request(app.getHttpServer())
          .put('/api/users/other-user-id')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ name: 'Hacked' })
          .expect(403);
      });
    });

    describe('POST /api/users/:id/change-password', () => {
      it('should change own password', async () => {
        await request(app.getHttpServer())
          .post(`/api/users/${testUserId}/change-password`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            currentPassword: 'Test123!@#',
            newPassword: 'NewTest123!@#',
          })
          .expect(200);

        // Verify new password works
        const loginResponse = await request(app.getHttpServer())
          .post('/api/auth/login')
          .send({
            email: 'e2e-test@example.com',
            password: 'NewTest123!@#',
          })
          .expect(200);

        expect(loginResponse.body).toHaveProperty('access_token');
      });

      it('should reject incorrect current password', async () => {
        await request(app.getHttpServer())
          .post(`/api/users/${testUserId}/change-password`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            currentPassword: 'wrong-password',
            newPassword: 'NewPassword123!',
          })
          .expect(401);
      });
    });
  });

  describe('Health Checks', () => {
    describe('GET /health', () => {
      it('should return health status', async () => {
        const response = await request(app.getHttpServer())
          .get('/health')
          .expect(200);

        expect(response.body).toHaveProperty('status');
        expect(response.body.status).toBe('ok');
      });
    });

    describe('GET /health/ready', () => {
      it('should return readiness status', async () => {
        const response = await request(app.getHttpServer())
          .get('/health/ready')
          .expect(200);

        expect(response.body).toHaveProperty('status');
        expect(response.body).toHaveProperty('info');
        expect(response.body.info).toHaveProperty('database');
        expect(response.body.info).toHaveProperty('redis');
      });
    });

    describe('GET /health/live', () => {
      it('should return liveness status', async () => {
        const response = await request(app.getHttpServer())
          .get('/health/live')
          .expect(200);

        expect(response.body).toHaveProperty('status');
        expect(response.body.status).toBe('ok');
      });
    });
  });

  describe('API Documentation', () => {
    describe('GET /api/docs', () => {
      it('should serve Swagger documentation', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/docs')
          .expect(200);

        expect(response.text).toContain('Swagger');
      });
    });

    describe('GET /api/docs-json', () => {
      it('should return OpenAPI specification', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/docs-json')
          .expect(200);

        expect(response.body).toHaveProperty('openapi');
        expect(response.body).toHaveProperty('info');
        expect(response.body).toHaveProperty('paths');
        expect(response.body.info.title).toBe('CC Task Manager Backend API');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 for unknown routes', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/unknown-route')
        .expect(404);

      expect(response.body).toHaveProperty('statusCode', 404);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('correlationId');
    });

    it('should handle malformed JSON', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
      expect(response.body).toHaveProperty('message');
    });

    it('should handle rate limiting', async () => {
      // Make multiple rapid requests to trigger rate limit
      const requests = Array(20).fill(null).map(() =>
        request(app.getHttpServer())
          .get('/api/tasks')
          .set('Authorization', `Bearer ${authToken}`)
      );

      const responses = await Promise.all(requests);
      const rateLimited = responses.some(r => r.status === 429);

      // Rate limiting might be configured, check if implemented
      if (rateLimited) {
        const limitedResponse = responses.find(r => r.status === 429);
        expect(limitedResponse?.body).toHaveProperty('message');
        expect(limitedResponse?.body.message).toContain('rate limit');
      }
    });
  });
});