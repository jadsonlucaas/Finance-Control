import { FinanceRepository } from '../../domain/FinanceRepository.js';
import { createApplicationDependencies } from '../dependencies/createApplicationDependencies.js';
import { ApplicationCommandGateway } from './ApplicationCommandGateway.js';
import { createFinanceCommandHandlers } from './financeCommandHandlers.js';
import { createFinanceQueryHandlers } from './financeQueryHandlers.js';
import { CommandHandlerRegistry, QueryHandlerRegistry } from './handlerRegistry.js';

export function createDefaultApplicationGateway(options = {}) {
  const dependencies = options.dependencies || (
    options.repository
      ? { repositories: { financeRecords: options.repository }, services: {}, clock: { now: options.now || (() => new Date().toISOString()) } }
      : createApplicationDependencies({
          mode: options.mode || 'web',
          target: options.target || globalThis,
          financeRecordDataSdk: options.financeRecordDataSdk || FinanceRepository,
          recordsProvider: options.recordsProvider,
          now: options.now
        })
  );
  const commandRegistry = new CommandHandlerRegistry(createFinanceCommandHandlers());
  const queryRegistry = new QueryHandlerRegistry(createFinanceQueryHandlers());
  return new ApplicationCommandGateway({
    commandRegistry,
    queryRegistry,
    repository: dependencies.repositories.financeRecords,
    dependencies,
    now: options.now,
    authorize: options.authorize,
    idempotencyStore: options.idempotencyStore,
    idempotencyRepository: options.idempotencyRepository || dependencies.repositories.idempotency,
    authContextProvider: options.authContextProvider || ((envelope) => ({
      actorUid: envelope.actor?.id || globalThis.currentUser?.uid || '',
      actorType: envelope.actor?.type || 'user',
      role: envelope.actor?.role || globalThis.currentUserRole || 'user',
      accountStatus: globalThis.currentAccountStatus || globalThis.currentUser?.status || 'active',
      ownerUid: globalThis.currentUser?.uid || envelope.actor?.id || '',
      permissions: globalThis.currentUserPermissions || [],
      trusted: false
    }))
  });
}
