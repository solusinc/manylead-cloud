"use client";

import { createContext, useContext, useMemo } from "react";
import { createContextualCan } from "@casl/react";

import type { AgentRole, AppAbility } from "@manylead/permissions";
import { defineAbilitiesFor } from "@manylead/permissions";

export const AbilityContext = createContext<AppAbility>(
  undefined as unknown as AppAbility,
);

/**
 * Componente <Can> declarativo para renderização condicional baseada em permissões
 * @example
 * ```tsx
 * <Can I="create" a="Agent">
 *   <Button>Criar Agente</Button>
 * </Can>
 * ```
 */
export const Can = createContextualCan(AbilityContext.Consumer);

interface AbilityProviderProps {
  role: AgentRole;
  userId: string;
  children: React.ReactNode;
}

/**
 * Provider que fornece o contexto de abilities para toda a aplicação
 * Deve ser colocado no nível mais alto da aplicação (layout raiz)
 */
export function AbilityProvider({
  role,
  userId,
  children,
}: AbilityProviderProps) {
  const ability = useMemo(
    () => defineAbilitiesFor(role, userId),
    [role, userId],
  );

  return (
    <AbilityContext.Provider value={ability}>
      {children}
    </AbilityContext.Provider>
  );
}

/**
 * Hook para acessar a instância de Ability
 * @throws Error se usado fora do AbilityProvider
 * @example
 * ```tsx
 * const ability = useAbility();
 * if (ability.can('read', 'Agent')) {
 *   // ...
 * }
 * ```
 */
export function useAbility() {
  const ability = useContext(AbilityContext);
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!ability) {
    throw new Error("useAbility must be used within AbilityProvider");
  }
  return ability;
}
