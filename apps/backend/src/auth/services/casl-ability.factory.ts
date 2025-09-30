import { Injectable } from '@nestjs/common';
import { Ability, AbilityBuilder, AbilityClass, ExtractSubjectType, InferSubjects } from '@casl/ability';

// Define subjects for authorization
type Subjects = InferSubjects<typeof Task | typeof User | typeof Project> | 'all';

// Define actions
export enum Action {
  Manage = 'manage',
  Create = 'create',
  Read = 'read',
  Update = 'update',
  Delete = 'delete',
}

// Define application ability type
export type AppAbility = Ability<[Action, Subjects]>;

// Mock entities for type safety - replace with actual entities
class Task {
  id: string;
  title: string;
  userId: string;
  projectId: string;
}

class User {
  id: string;
  email: string;
  role: string;
}

class Project {
  id: string;
  name: string;
  ownerId: string;
  members: string[];
}

@Injectable()
export class CaslAbilityFactory {
  createForUser(user: any) {
    const { can, cannot, build } = new AbilityBuilder<
      Ability<[Action, Subjects]>
    >(Ability as AbilityClass<AppAbility>);

    // Define permissions based on user role
    if (user.role === 'admin') {
      // Admin can manage everything
      can(Action.Manage, 'all');
    } else if (user.role === 'manager') {
      // Manager can manage projects and tasks
      can(Action.Manage, Task);
      can(Action.Manage, Project);
      can(Action.Read, User);
      can(Action.Update, User, { id: user.userId });
    } else if (user.role === 'user') {
      // Users can only manage their own tasks and read projects they're members of
      can(Action.Create, Task);
      can(Action.Read, Task, { userId: user.userId });
      can(Action.Update, Task, { userId: user.userId });
      can(Action.Delete, Task, { userId: user.userId });

      // Users can read projects they're members of
      can(Action.Read, Project, { members: { $in: [user.userId] } });

      // Users can update their own profile
      can(Action.Read, User, { id: user.userId });
      can(Action.Update, User, { id: user.userId });
    }

    // Additional permission-based access control
    if (user.permissions?.includes('task:admin')) {
      can(Action.Manage, Task);
    }

    if (user.permissions?.includes('project:admin')) {
      can(Action.Manage, Project);
    }

    if (user.permissions?.includes('user:admin')) {
      can(Action.Manage, User);
    }

    return build({
      // Read https://casl.js.org/v6/en/guide/subject-type-detection#use-classes-as-subject-types for details
      detectSubjectType: (item) =>
        item.constructor as ExtractSubjectType<Subjects>,
    });
  }
}