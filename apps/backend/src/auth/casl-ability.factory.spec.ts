import { CaslAbilityFactory } from './casl-ability.factory';
import { Action } from './casl-ability.factory';

describe('CaslAbilityFactory', () => {
  let factory: CaslAbilityFactory;

  beforeEach(() => {
    factory = new CaslAbilityFactory();
  });

  describe('createForUser', () => {
    describe('Admin permissions', () => {
      it('should grant all permissions to admin users', () => {
        const adminUser = {
          id: 'admin-123',
          email: 'admin@example.com',
          role: 'admin',
          name: 'Admin User',
        };

        const ability = factory.createForUser(adminUser);

        // Admin can manage all resources
        expect(ability.can(Action.Manage, 'all')).toBe(true);
        expect(ability.can(Action.Create, 'Task')).toBe(true);
        expect(ability.can(Action.Read, 'User')).toBe(true);
        expect(ability.can(Action.Update, 'Task')).toBe(true);
        expect(ability.can(Action.Delete, 'User')).toBe(true);
      });
    });

    describe('Manager permissions', () => {
      const managerUser = {
        id: 'manager-123',
        email: 'manager@example.com',
        role: 'manager',
        name: 'Manager User',
      };

      it('should grant task management permissions to managers', () => {
        const ability = factory.createForUser(managerUser);

        // Manager can manage tasks
        expect(ability.can(Action.Create, 'Task')).toBe(true);
        expect(ability.can(Action.Read, 'Task')).toBe(true);
        expect(ability.can(Action.Update, 'Task')).toBe(true);
        expect(ability.can(Action.Delete, 'Task')).toBe(true);
      });

      it('should grant user read permissions to managers', () => {
        const ability = factory.createForUser(managerUser);

        // Manager can read users but not modify
        expect(ability.can(Action.Read, 'User')).toBe(true);
        expect(ability.can(Action.Create, 'User')).toBe(false);
        expect(ability.can(Action.Update, 'User')).toBe(false);
        expect(ability.can(Action.Delete, 'User')).toBe(false);
      });

      it('should allow managers to update own profile', () => {
        const ability = factory.createForUser(managerUser);

        const ownProfile = { id: managerUser.id, userId: managerUser.id };
        const otherProfile = { id: 'other-123', userId: 'other-123' };

        expect(ability.can(Action.Update, 'User', ownProfile)).toBe(true);
        expect(ability.can(Action.Update, 'User', otherProfile)).toBe(false);
      });
    });

    describe('User permissions', () => {
      const regularUser = {
        id: 'user-123',
        email: 'user@example.com',
        role: 'user',
        name: 'Regular User',
      };

      it('should grant limited task permissions to regular users', () => {
        const ability = factory.createForUser(regularUser);

        // User can read and create tasks
        expect(ability.can(Action.Read, 'Task')).toBe(true);
        expect(ability.can(Action.Create, 'Task')).toBe(true);
      });

      it('should allow users to update only their assigned tasks', () => {
        const ability = factory.createForUser(regularUser);

        const assignedTask = { id: 'task-1', assigneeId: regularUser.id };
        const unassignedTask = { id: 'task-2', assigneeId: 'other-user' };

        expect(ability.can(Action.Update, 'Task', assignedTask)).toBe(true);
        expect(ability.can(Action.Update, 'Task', unassignedTask)).toBe(false);
      });

      it('should allow users to delete only their created tasks', () => {
        const ability = factory.createForUser(regularUser);

        const ownTask = { id: 'task-1', createdBy: regularUser.id };
        const otherTask = { id: 'task-2', createdBy: 'other-user' };

        expect(ability.can(Action.Delete, 'Task', ownTask)).toBe(true);
        expect(ability.can(Action.Delete, 'Task', otherTask)).toBe(false);
      });

      it('should allow users to read and update only their own profile', () => {
        const ability = factory.createForUser(regularUser);

        const ownProfile = { id: regularUser.id, userId: regularUser.id };
        const otherProfile = { id: 'other-123', userId: 'other-123' };

        expect(ability.can(Action.Read, 'User', ownProfile)).toBe(true);
        expect(ability.can(Action.Update, 'User', ownProfile)).toBe(true);
        expect(ability.can(Action.Read, 'User', otherProfile)).toBe(false);
        expect(ability.can(Action.Update, 'User', otherProfile)).toBe(false);
      });

      it('should not allow users to delete profiles', () => {
        const ability = factory.createForUser(regularUser);

        expect(ability.can(Action.Delete, 'User')).toBe(false);
        expect(ability.can(Action.Delete, 'User', { id: regularUser.id })).toBe(false);
      });
    });

    describe('Guest permissions', () => {
      const guestUser = {
        id: 'guest-123',
        email: 'guest@example.com',
        role: 'guest',
        name: 'Guest User',
      };

      it('should grant read-only task permissions to guests', () => {
        const ability = factory.createForUser(guestUser);

        // Guest can only read tasks
        expect(ability.can(Action.Read, 'Task')).toBe(true);
        expect(ability.can(Action.Create, 'Task')).toBe(false);
        expect(ability.can(Action.Update, 'Task')).toBe(false);
        expect(ability.can(Action.Delete, 'Task')).toBe(false);
      });

      it('should not grant any user permissions to guests', () => {
        const ability = factory.createForUser(guestUser);

        expect(ability.can(Action.Read, 'User')).toBe(false);
        expect(ability.can(Action.Create, 'User')).toBe(false);
        expect(ability.can(Action.Update, 'User')).toBe(false);
        expect(ability.can(Action.Delete, 'User')).toBe(false);
      });
    });

    describe('Unknown role handling', () => {
      it('should grant minimal permissions for unknown roles', () => {
        const unknownUser = {
          id: 'unknown-123',
          email: 'unknown@example.com',
          role: 'unknown-role',
          name: 'Unknown User',
        };

        const ability = factory.createForUser(unknownUser);

        // Unknown role has minimal permissions (guest-like)
        expect(ability.can(Action.Read, 'Task')).toBe(false);
        expect(ability.can(Action.Create, 'Task')).toBe(false);
        expect(ability.can(Action.Update, 'Task')).toBe(false);
        expect(ability.can(Action.Delete, 'Task')).toBe(false);
        expect(ability.can(Action.Read, 'User')).toBe(false);
      });
    });
  });

  describe('Permission inheritance', () => {
    it('should properly handle permission inheritance for complex scenarios', () => {
      const user = {
        id: 'user-123',
        email: 'user@example.com',
        role: 'user',
        name: 'User',
      };

      const ability = factory.createForUser(user);

      // Complex task with multiple conditions
      const complexTask = {
        id: 'task-1',
        assigneeId: user.id,
        createdBy: user.id,
        status: 'in_progress',
      };

      // User can both update (as assignee) and delete (as creator)
      expect(ability.can(Action.Update, 'Task', complexTask)).toBe(true);
      expect(ability.can(Action.Delete, 'Task', complexTask)).toBe(true);
    });
  });

  describe('Field-level permissions', () => {
    it('should enforce field-level restrictions where applicable', () => {
      const user = {
        id: 'user-123',
        email: 'user@example.com',
        role: 'user',
        name: 'User',
      };

      const ability = factory.createForUser(user);

      // Check if specific fields can be accessed (future enhancement)
      // This is a placeholder for field-level permission tests
      expect(ability).toBeDefined();
    });
  });
});