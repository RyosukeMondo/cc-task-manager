import { Injectable } from '@nestjs/common';
import { Ability, AbilityBuilder, AbilityClass, ExtractSubjectType, InferSubjects } from '@casl/ability';
import { UserRole, JWTPayload } from '../schemas/auth.schemas';

/**
 * Define all possible subjects for authorization using string literals
 */
export type Subjects = 'User' | 'Task' | 'Project' | 'all';

/**
 * Define all possible actions
 */
export enum Actions {
  Manage = 'manage',
  Create = 'create',
  Read = 'read',
  Update = 'update',
  Delete = 'delete',
  Execute = 'execute',
  Approve = 'approve',
  Assign = 'assign',
}

/**
 * Define entity interfaces for CASL
 */
export interface User {
  id: string;
  email: string;
  role: UserRole;
  organizationId?: string;
}

export interface Task {
  id: string;
  title: string;
  createdBy: string;
  assignedTo?: string;
  projectId?: string;
  organizationId?: string;
}

export interface Project {
  id: string;
  name: string;
  ownerId: string;
  members: string[];
  organizationId?: string;
}

/**
 * Define ability type
 */
export type AppAbility = Ability<[Actions, Subjects]>;

/**
 * CASL Ability Factory following Open/Closed Principle
 * Extensible for new permissions without modifying existing code
 */
@Injectable()
export class CaslAbilityFactory {
  /**
   * Create ability instance for a user
   * Implements attribute-based access control with fine-grained permissions
   */
  createForUser(user: JWTPayload): AppAbility {
    const { can, cannot, build } = new AbilityBuilder<Ability<[Actions, Subjects]>>(
      Ability as AbilityClass<AppAbility>
    );

    // Define permissions based on user role
    switch (user.role) {
      case UserRole.ADMIN:
        this.defineAdminPermissions(can, cannot, user);
        break;
      case UserRole.MODERATOR:
        this.defineModeratorPermissions(can, cannot, user);
        break;
      case UserRole.USER:
        this.defineUserPermissions(can, cannot, user);
        break;
      default:
        // No permissions for unknown roles
        break;
    }

    return build();
  }

  /**
   * Define admin permissions - full access to everything
   * Following Liskov Substitution Principle
   */
  private defineAdminPermissions(can: any, cannot: any, user: JWTPayload) {
    // Admins can manage everything
    can(Actions.Manage, 'all');
  }

  /**
   * Define moderator permissions - limited administrative access
   * Following Liskov Substitution Principle
   */
  private defineModeratorPermissions(can: any, cannot: any, user: JWTPayload) {
    // Moderators can read everything
    can(Actions.Read, 'all');

    // Moderators can manage users (except other moderators/admins)
    can(Actions.Update, 'User', { role: UserRole.USER });
    can(Actions.Delete, 'User', { role: UserRole.USER });

    // Moderators can manage tasks and projects
    can(Actions.Manage, 'Task');
    can(Actions.Manage, 'Project');

    // Moderators cannot manage other moderators or admins
    cannot(Actions.Update, 'User', { role: { $in: [UserRole.MODERATOR, UserRole.ADMIN] } });
    cannot(Actions.Delete, 'User', { role: { $in: [UserRole.MODERATOR, UserRole.ADMIN] } });
  }

  /**
   * Define user permissions - standard user access
   * Following Liskov Substitution Principle
   */
  private defineUserPermissions(can: any, cannot: any, user: JWTPayload) {
    // Users can read their own profile
    can(Actions.Read, 'User', { id: user.sub });
    can(Actions.Update, 'User', { id: user.sub });

    // Users can create new tasks and projects
    can(Actions.Create, 'Task');
    can(Actions.Create, 'Project');

    // Users can read tasks assigned to them or created by them
    can(Actions.Read, 'Task', { assignedTo: user.sub });
    can(Actions.Read, 'Task', { createdBy: user.sub });

    // Users can update tasks they created or are assigned to
    can(Actions.Update, 'Task', { createdBy: user.sub });
    can(Actions.Update, 'Task', { assignedTo: user.sub });

    // Users can delete tasks they created
    can(Actions.Delete, 'Task', { createdBy: user.sub });

    // Users can read projects they own or are members of
    can(Actions.Read, 'Project', { ownerId: user.sub });
    can(Actions.Read, 'Project', { members: { $in: [user.sub] } });

    // Users can update projects they own
    can(Actions.Update, 'Project', { ownerId: user.sub });

    // Users can delete projects they own
    can(Actions.Delete, 'Project', { ownerId: user.sub });

    // Users can assign tasks within projects they own
    can(Actions.Assign, 'Task', { 
      projectId: { $exists: true },
      // This would need to be validated against project ownership in the business logic
    });

    // Users cannot read other users' profiles
    cannot(Actions.Read, 'User', { id: { $ne: user.sub } });
    cannot(Actions.Update, 'User', { id: { $ne: user.sub } });
    cannot(Actions.Delete, 'User');
  }

  /**
   * Check if user can perform action on subject
   * Convenience method for ability checking
   */
  checkAbility(user: JWTPayload, action: Actions, subject: Subjects): boolean {
    const ability = this.createForUser(user);
    return ability.can(action, subject);
  }

  /**
   * Get all permissions for a user
   * Useful for frontend permission management
   */
  getUserPermissions(user: JWTPayload): Record<string, string[]> {
    const ability = this.createForUser(user);
    const permissions: Record<string, string[]> = {};

    // Extract rules and organize by subject
    ability.rules.forEach((rule) => {
      const subject = rule.subject as string;
      const actions = Array.isArray(rule.action) ? rule.action : [rule.action];
      
      if (!permissions[subject]) {
        permissions[subject] = [];
      }
      
      actions.forEach((action) => {
        if (!permissions[subject].includes(action)) {
          permissions[subject].push(action);
        }
      });
    });

    return permissions;
  }
}