"use client";

import { useState } from "react";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";

import type { QuickReplySelection } from "../quick-reply-dropdown";
import { useServerSession } from "~/components/providers/session-provider";
import { useTRPC } from "~/lib/trpc/react";
import { useChatReply } from "../../providers/chat-reply-provider";
import { useNotificationSound } from "~/hooks/use-notification-sound";

/**
 * Extrai todas as variáveis de um texto no formato {{variavel}}
 */
function extractVariables(text: string): string[] {
  const regex = /\{\{([^}]+)\}\}/g;
  const variables: string[] = [];
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match[1]) {
      variables.push(match[1]);
    }
  }

  return [...new Set(variables)]; // Remove duplicatas
}

/**
 * Handles quick reply selection and sending via backend
 */
export function useQuickReplySelect(chatId: string) {
  const queryClient = useQueryClient();
  const session = useServerSession();
  const trpc = useTRPC();
  const { contactName } = useChatReply();
  const { playNotificationSound } = useNotificationSound();

  // State para gerenciar variáveis customizadas
  const [customVariablesDialog, setCustomVariablesDialog] = useState<{
    open: boolean;
    variables: string[];
    selection: QuickReplySelection | null;
  }>({
    open: false,
    variables: [],
    selection: null,
  });

  // Buscar organização atual
  const { data: currentOrganization } = useQuery(
    trpc.organization.getCurrent.queryOptions(),
  );

  const sendQuickReplyMutation = useMutation(
    trpc.quickReplies.send.mutationOptions(),
  );

  /**
   * Processa variáveis conhecidas e customizadas
   */
  const processVariables = (
    content: string,
    customValues?: Record<string, string>
  ): { processed: string; unresolvedVariables: string[] } => {
    // Variáveis conhecidas do sistema
    let processed = content
      .replace(/\{\{contact\.name\}\}/g, contactName)
      .replace(/\{\{agent\.name\}\}/g, session.user.name)
      .replace(/\{\{organization\.name\}\}/g, currentOrganization?.name ?? "");

    // Substituir variáveis customizadas se fornecidas
    if (customValues) {
      Object.entries(customValues).forEach(([key, value]) => {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
        processed = processed.replace(regex, value);
      });
    }

    // Detectar variáveis não resolvidas
    const unresolvedVariables = extractVariables(processed);

    return { processed, unresolvedVariables };
  };

  /**
   * Envia mensagem com variáveis já resolvidas
   */
  const sendWithVariables = async (
    selection: QuickReplySelection,
    customValues?: Record<string, string>,
    forceSend = false
  ): Promise<string | null> => {
    const { messages } = selection;

    if (messages.length === 0) {
      return null;
    }

    // Se tem apenas uma mensagem de texto SEM mídia E não está forçando envio, retornar para o input
    const firstMessage = messages[0];
    if (
      !forceSend &&
      messages.length === 1 &&
      firstMessage?.type === "text" &&
      !firstMessage.mediaUrl
    ) {
      const { processed } = processVariables(firstMessage.content, customValues);
      return processed;
    }

    // Múltiplas mensagens OU com mídia OU forçando envio: enviar via backend
    try {
      await sendQuickReplyMutation.mutateAsync({
        quickReplyId: selection.id,
        chatId,
        variables: {
          contactName,
          agentName: session.user.name,
          organizationName: currentOrganization?.name ?? "",
          ...customValues, // Adicionar variáveis customizadas
        },
      });

      // Tocar som de notificação
      playNotificationSound();

      // Invalidate queries para atualizar lista de chats
      void queryClient.invalidateQueries({ queryKey: [["chats", "list"]] });

      // Return null para limpar o input
      return null;
    } catch (error) {
      console.error("Failed to send quick reply:", error);
      throw error;
    }
  };

  /**
   * Handle quick reply selection
   * - Detecta variáveis customizadas e abre modal se necessário
   * - Single text message without media: Returns content to be placed in input
   * - Multiple messages or with media: Sends via backend
   */
  const handleQuickReplySelect = async (selection: QuickReplySelection): Promise<string | null> => {
    const { messages } = selection;

    if (messages.length === 0) {
      return null;
    }

    // Extrair todas as variáveis de todas as mensagens
    const allVariables = messages.flatMap((msg) =>
      msg.type === "text" ? extractVariables(msg.content) : []
    );

    // Variáveis conhecidas do sistema
    const knownVariables = ["contact.name", "agent.name", "organization.name"];

    // Detectar variáveis customizadas (desconhecidas)
    const customVariables = allVariables.filter(
      (v) => !knownVariables.includes(v)
    );

    // Se tem variáveis customizadas, abrir modal
    if (customVariables.length > 0) {
      setCustomVariablesDialog({
        open: true,
        variables: customVariables,
        selection,
      });
      return null; // Aguardar user preencher
    }

    // Sem variáveis customizadas, enviar normalmente
    return sendWithVariables(selection);
  };

  /**
   * Callback chamado quando user preenche as variáveis customizadas no modal
   */
  const handleCustomVariablesSubmit = async (values: Record<string, string>): Promise<string | null> => {
    if (!customVariablesDialog.selection) return null;

    // Enviar com as variáveis customizadas preenchidas - sempre envia direto (forceSend = true)
    const result = await sendWithVariables(customVariablesDialog.selection, values, true);

    // Fechar modal
    setCustomVariablesDialog({
      open: false,
      variables: [],
      selection: null,
    });

    return result;
  };

  return {
    handleQuickReplySelect,
    customVariablesDialog,
    handleCustomVariablesSubmit,
    setCustomVariablesDialog,
  };
}
