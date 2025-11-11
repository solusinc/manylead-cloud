import type { PureAbility } from '@casl/ability';
import type { Actions, Subjects } from './subjects';

/**
 * AppAbility é o tipo principal que define as capacidades da aplicação
 */
export type AppAbility = PureAbility<[Actions, Subjects]>;

/**
 * AgentRole define os 3 níveis de acesso no sistema
 */
export type AgentRole = 'owner' | 'admin' | 'member';
