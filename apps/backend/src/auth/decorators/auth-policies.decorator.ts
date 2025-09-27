import { CheckPolicies } from './check-policies.decorator';
import { Action } from '../services/casl-ability.factory';

// Common policy helpers
export class ReadTaskPolicyHandler {
  handle(ability: any) {
    return ability.can(Action.Read, 'Task');
  }
}

export class CreateTaskPolicyHandler {
  handle(ability: any) {
    return ability.can(Action.Create, 'Task');
  }
}

export class UpdateTaskPolicyHandler {
  handle(ability: any) {
    return ability.can(Action.Update, 'Task');
  }
}

export class DeleteTaskPolicyHandler {
  handle(ability: any) {
    return ability.can(Action.Delete, 'Task');
  }
}

export class ManageTaskPolicyHandler {
  handle(ability: any) {
    return ability.can(Action.Manage, 'Task');
  }
}

// Convenience decorators for common use cases
export const CanReadTasks = () => CheckPolicies(new ReadTaskPolicyHandler());
export const CanCreateTasks = () => CheckPolicies(new CreateTaskPolicyHandler());
export const CanUpdateTasks = () => CheckPolicies(new UpdateTaskPolicyHandler());
export const CanDeleteTasks = () => CheckPolicies(new DeleteTaskPolicyHandler());
export const CanManageTasks = () => CheckPolicies(new ManageTaskPolicyHandler());

// User management policies
export class ReadUserPolicyHandler {
  handle(ability: any) {
    return ability.can(Action.Read, 'User');
  }
}

export class ManageUserPolicyHandler {
  handle(ability: any) {
    return ability.can(Action.Manage, 'User');
  }
}

export const CanReadUsers = () => CheckPolicies(new ReadUserPolicyHandler());
export const CanManageUsers = () => CheckPolicies(new ManageUserPolicyHandler());

// Project management policies
export class ReadProjectPolicyHandler {
  handle(ability: any) {
    return ability.can(Action.Read, 'Project');
  }
}

export class ManageProjectPolicyHandler {
  handle(ability: any) {
    return ability.can(Action.Manage, 'Project');
  }
}

export const CanReadProjects = () => CheckPolicies(new ReadProjectPolicyHandler());
export const CanManageProjects = () => CheckPolicies(new ManageProjectPolicyHandler());