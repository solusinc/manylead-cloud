"use client";

import { useQuery } from "@tanstack/react-query";

import { formatBrazilianPhone, maskPhoneLastDigits } from "@manylead/shared/utils";
import { useTRPC } from "~/lib/trpc/react";
import { usePermissions } from "~/lib/permissions/use-permissions";

/**
 * Hook para formatar números de telefone respeitando a configuração de privacidade
 *
 * - Se o usuário for member E a organização tiver hidePhoneDigits ativado,
 *   os últimos 4 dígitos serão mascarados com ••••
 * - Caso contrário, exibe o número formatado normalmente
 */
export function usePhoneDisplay() {
  const trpc = useTRPC();
  const { isMember } = usePermissions();

  const { data: preferences } = useQuery(
    trpc.organizationSettings.getDisplayPreferences.queryOptions(),
  );

  const shouldMask = isMember && (preferences?.hidePhoneDigits ?? false);

  /**
   * Formata o número de telefone respeitando privacidade
   */
  const formatPhone = (phone: string | null | undefined): string => {
    if (!phone) return "Sem número";

    const formatted = formatBrazilianPhone(phone);

    if (shouldMask) {
      return maskPhoneLastDigits(formatted, 4);
    }

    return formatted;
  };

  return {
    formatPhone,
    shouldMask,
    hidePhoneDigits: preferences?.hidePhoneDigits ?? false,
    includeUserName: preferences?.includeUserName ?? false,
  };
}
