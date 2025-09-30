import { SetMetadata } from '@nestjs/common';
import { AppAbility } from '../services/casl-ability.factory';

export const CHECK_POLICIES_KEY = 'check_policy';

interface IPolicyHandler {
  handle(ability: AppAbility): boolean;
}

type PolicyHandlerCallback = (ability: AppAbility) => boolean;
type PolicyHandler = IPolicyHandler | PolicyHandlerCallback;

export const CheckPolicies = (...handlers: PolicyHandler[]) =>
  SetMetadata(CHECK_POLICIES_KEY, handlers);