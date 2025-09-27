import { PactTestRunner, Matchers } from '../../../../src/contracts/tests/PactTestRunner';
import { ContractRegistry } from '../../../../src/contracts/ContractRegistry';
import axios from 'axios';

describe('Backend API Contract Tests', () => {
  const pact = new PactTestRunner({
    consumer: 'cc-task-manager-frontend',
    provider: 'cc-task-manager-backend',
    port: 8080,
  });

  const contractRegistry = ContractRegistry.getInstance();

  beforeAll(async () => {
    await pact.setup();
  });

  afterAll(async () => {
    await pact.teardown();
  });

  describe('Authentication Contracts', () => {
    it('should verify login request/response contract', async () => {
      const loginRequest = {
        email: 'user@example.com',
        password: 'password123',
      };

      const expectedResponse = {
        access_token: Matchers.string('jwt.token.here'),
        user: Matchers.like({
          id: Matchers.uuid(),
          email: Matchers.email(),
          name: Matchers.string('John Doe'),
          role: Matchers.term({
            matcher: '^(admin|manager|user|guest)$',
            generate: 'user',
          }),
        }),
      };

      pact.addHttpInteraction({
        uponReceiving: 'a login request',
        withRequest: {
          method: 'POST',
          path: '/api/auth/login',
          headers: { 'Content-Type': 'application/json' },
          body: loginRequest,
        },
        willRespondWith: {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: expectedResponse,
        },
      });

      await pact.executeTest(async (mockServer) => {
        const response = await axios.post(
          `${mockServer.url}/api/auth/login`,
          loginRequest,
          { headers: { 'Content-Type': 'application/json' } }
        );

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('access_token');
        expect(response.data.user).toHaveProperty('id');
        expect(response.data.user).toHaveProperty('email');
      });
    });

    it('should verify registration contract', async () => {
      const registerRequest = {
        email: 'newuser@example.com',
        password: 'securePassword123',
        name: 'New User',
      };

      const expectedResponse = {
        access_token: Matchers.string(),
        user: Matchers.like({
          id: Matchers.uuid(),
          email: registerRequest.email,
          name: registerRequest.name,
          role: 'user',
        }),
      };

      pact.addHttpInteraction({
        uponReceiving: 'a registration request',
        withRequest: {
          method: 'POST',
          path: '/api/auth/register',
          headers: { 'Content-Type': 'application/json' },
          body: registerRequest,
        },
        willRespondWith: {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
          body: expectedResponse,
        },
      });

      await pact.executeTest(async (mockServer) => {
        const response = await axios.post(
          `${mockServer.url}/api/auth/register`,
          registerRequest
        );

        expect(response.status).toBe(201);
        expect(response.data).toHaveProperty('access_token');
        expect(response.data.user.email).toBe(registerRequest.email);
      });
    });

    it('should verify token refresh contract', async () => {
      const refreshToken = 'valid.refresh.token';

      pact.addHttpInteraction({
        uponReceiving: 'a token refresh request',
        withRequest: {
          method: 'POST',
          path: '/api/auth/refresh',
          headers: {
            Authorization: `Bearer ${refreshToken}`,
          },
        },
        willRespondWith: {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: {
            access_token: Matchers.string(),
          },
        },
      });

      await pact.executeTest(async (mockServer) => {
        const response = await axios.post(
          `${mockServer.url}/api/auth/refresh`,
          {},
          { headers: { Authorization: `Bearer ${refreshToken}` } }
        );

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('access_token');
      });
    });
  });

  describe('Task Management Contracts', () => {
    const authToken = 'valid.jwt.token';

    it('should verify create task contract', async () => {
      const createTaskRequest = {
        title: 'New Task',
        description: 'Task Description',
        priority: 'high',
        assigneeId: Matchers.uuid(),
        dueDate: Matchers.iso8601DateTime(),
        tags: ['urgent', 'backend'],
      };

      const expectedResponse = Matchers.like({
        id: Matchers.uuid(),
        ...createTaskRequest,
        status: 'pending',
        createdBy: Matchers.uuid(),
        createdAt: Matchers.iso8601DateTime(),
        updatedAt: Matchers.iso8601DateTime(),
      });

      pact.addHttpInteraction({
        uponReceiving: 'a create task request',
        withRequest: {
          method: 'POST',
          path: '/api/tasks',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: createTaskRequest,
        },
        willRespondWith: {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
          body: expectedResponse,
        },
      });

      await pact.executeTest(async (mockServer) => {
        const response = await axios.post(
          `${mockServer.url}/api/tasks`,
          createTaskRequest,
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${authToken}`,
            },
          }
        );

        expect(response.status).toBe(201);
        expect(response.data).toHaveProperty('id');
        expect(response.data.status).toBe('pending');
      });
    });

    it('should verify get tasks list contract', async () => {
      const expectedResponse = {
        data: Matchers.eachLike({
          id: Matchers.uuid(),
          title: Matchers.string(),
          description: Matchers.string(),
          status: Matchers.term({
            matcher: '^(pending|in_progress|completed|cancelled)$',
            generate: 'pending',
          }),
          priority: Matchers.term({
            matcher: '^(low|medium|high|critical)$',
            generate: 'medium',
          }),
          assigneeId: Matchers.uuid(),
          createdBy: Matchers.uuid(),
          createdAt: Matchers.iso8601DateTime(),
          updatedAt: Matchers.iso8601DateTime(),
        }),
        total: Matchers.integer(10),
        page: Matchers.integer(1),
        limit: Matchers.integer(10),
        totalPages: Matchers.integer(1),
      };

      pact.addHttpInteraction({
        uponReceiving: 'a request for tasks list',
        withRequest: {
          method: 'GET',
          path: '/api/tasks',
          query: {
            page: '1',
            limit: '10',
            status: 'pending',
          },
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        },
        willRespondWith: {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: expectedResponse,
        },
      });

      await pact.executeTest(async (mockServer) => {
        const response = await axios.get(`${mockServer.url}/api/tasks`, {
          params: { page: 1, limit: 10, status: 'pending' },
          headers: { Authorization: `Bearer ${authToken}` },
        });

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('data');
        expect(response.data).toHaveProperty('total');
        expect(Array.isArray(response.data.data)).toBe(true);
      });
    });

    it('should verify update task status contract', async () => {
      const taskId = 'task-123';
      const updateRequest = { status: 'in_progress' };

      pact.addHttpInteraction({
        uponReceiving: 'a task status update request',
        withRequest: {
          method: 'PATCH',
          path: `/api/tasks/${taskId}/status`,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: updateRequest,
        },
        willRespondWith: {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: Matchers.like({
            id: taskId,
            status: updateRequest.status,
            updatedAt: Matchers.iso8601DateTime(),
          }),
        },
      });

      await pact.executeTest(async (mockServer) => {
        const response = await axios.patch(
          `${mockServer.url}/api/tasks/${taskId}/status`,
          updateRequest,
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${authToken}`,
            },
          }
        );

        expect(response.status).toBe(200);
        expect(response.data.status).toBe('in_progress');
      });
    });
  });

  describe('User Management Contracts', () => {
    const authToken = 'admin.jwt.token';

    it('should verify get user profile contract', async () => {
      const userId = 'user-123';

      pact.addHttpInteraction({
        uponReceiving: 'a user profile request',
        withRequest: {
          method: 'GET',
          path: `/api/users/${userId}`,
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        },
        willRespondWith: {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: Matchers.like({
            id: userId,
            email: Matchers.email(),
            name: Matchers.string(),
            role: Matchers.string(),
            createdAt: Matchers.iso8601DateTime(),
            updatedAt: Matchers.iso8601DateTime(),
          }),
        },
      });

      await pact.executeTest(async (mockServer) => {
        const response = await axios.get(`${mockServer.url}/api/users/${userId}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });

        expect(response.status).toBe(200);
        expect(response.data.id).toBe(userId);
        expect(response.data).toHaveProperty('email');
      });
    });

    it('should verify update user profile contract', async () => {
      const userId = 'user-123';
      const updateRequest = {
        name: 'Updated Name',
        email: 'updated@example.com',
      };

      pact.addHttpInteraction({
        uponReceiving: 'a user profile update request',
        withRequest: {
          method: 'PUT',
          path: `/api/users/${userId}`,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: updateRequest,
        },
        willRespondWith: {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: Matchers.like({
            id: userId,
            ...updateRequest,
            updatedAt: Matchers.iso8601DateTime(),
          }),
        },
      });

      await pact.executeTest(async (mockServer) => {
        const response = await axios.put(
          `${mockServer.url}/api/users/${userId}`,
          updateRequest,
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${authToken}`,
            },
          }
        );

        expect(response.status).toBe(200);
        expect(response.data.name).toBe(updateRequest.name);
        expect(response.data.email).toBe(updateRequest.email);
      });
    });
  });

  describe('WebSocket Event Contracts', () => {
    it('should verify task update event contract', async () => {
      const taskUpdateEvent = {
        event: 'task.updated',
        data: {
          id: Matchers.uuid(),
          title: Matchers.string(),
          status: Matchers.string(),
          updatedAt: Matchers.iso8601DateTime(),
        },
      };

      // Message pact for WebSocket events
      pact.addMessageInteraction({
        description: 'a task update WebSocket event',
        contents: taskUpdateEvent,
      });

      const messageHandler = jest.fn();
      await pact.executeMessageTest(messageHandler);

      expect(messageHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'task.updated',
          data: expect.objectContaining({
            id: expect.any(String),
          }),
        })
      );
    });

    it('should verify task assignment notification contract', async () => {
      const assignmentEvent = {
        event: 'task.assigned',
        data: {
          taskId: Matchers.uuid(),
          assigneeId: Matchers.uuid(),
          assignedBy: Matchers.uuid(),
          task: Matchers.like({
            id: Matchers.uuid(),
            title: Matchers.string(),
            description: Matchers.string(),
          }),
        },
      };

      pact.addMessageInteraction({
        description: 'a task assignment WebSocket notification',
        contents: assignmentEvent,
      });

      const messageHandler = jest.fn();
      await pact.executeMessageTest(messageHandler);

      expect(messageHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'task.assigned',
        })
      );
    });
  });

  describe('Error Response Contracts', () => {
    it('should verify validation error contract', async () => {
      const invalidRequest = {
        // Missing required fields
        description: 'Task without title',
      };

      pact.addHttpInteraction({
        uponReceiving: 'an invalid task creation request',
        withRequest: {
          method: 'POST',
          path: '/api/tasks',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer valid.token',
          },
          body: invalidRequest,
        },
        willRespondWith: {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
          body: {
            statusCode: 400,
            message: Matchers.eachLike(Matchers.string()),
            error: 'Bad Request',
            correlationId: Matchers.uuid(),
          },
        },
      });

      await pact.executeTest(async (mockServer) => {
        try {
          await axios.post(`${mockServer.url}/api/tasks`, invalidRequest, {
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer valid.token',
            },
          });
        } catch (error: any) {
          expect(error.response.status).toBe(400);
          expect(error.response.data).toHaveProperty('message');
          expect(error.response.data).toHaveProperty('correlationId');
        }
      });
    });

    it('should verify unauthorized error contract', async () => {
      pact.addHttpInteraction({
        uponReceiving: 'a request without authentication',
        withRequest: {
          method: 'GET',
          path: '/api/tasks',
        },
        willRespondWith: {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
          body: {
            statusCode: 401,
            message: 'Unauthorized',
            correlationId: Matchers.uuid(),
          },
        },
      });

      await pact.executeTest(async (mockServer) => {
        try {
          await axios.get(`${mockServer.url}/api/tasks`);
        } catch (error: any) {
          expect(error.response.status).toBe(401);
          expect(error.response.data.message).toBe('Unauthorized');
        }
      });
    });
  });
});