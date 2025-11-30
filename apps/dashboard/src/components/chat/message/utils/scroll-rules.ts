import type { ScrollBehavior, ScrollContext, ScrollTrigger } from "./scroll-types";

export const SCROLL_CONSTANTS = {
  NEAR_BOTTOM_THRESHOLD: 300, // Increased from 200 to handle attachments/documents
  IMAGE_LOAD_THRESHOLD: 300,
  RECENT_MESSAGE_COUNT: 5,
  LOADING_PROTECTION_MS: 1000,
  CHAT_UPDATE_DELAY_MS: 300,
  SCROLL_BUTTON_THRESHOLD: 300,
} as const;

/**
 * ScrollRuleEngine - Centraliza TODAS as 11 regras de scroll
 * Single source of truth para decisões de scroll
 */
export class ScrollRuleEngine {
  /**
   * Regra Global: NUNCA scrolla ao carregar mensagens antigas
   */
  shouldScroll(trigger: ScrollTrigger, context: ScrollContext): boolean {
    // Proteção global
    if (context.isLoadingOlder) {
      return false;
    }

    switch (trigger) {
      case "initial_load":
      case "own_message":
      case "system_message":
      case "manual_button":
        return true;

      case "received_message":
        return context.distanceFromBottom < SCROLL_CONSTANTS.NEAR_BOTTOM_THRESHOLD;

      case "typing_indicator":
      case "chat_updated":
        return true;

      case "image_load_recent": {
        const isRecent =
          context.messageIndex >= context.totalMessages - SCROLL_CONSTANTS.RECENT_MESSAGE_COUNT;
        const isNearBottom = context.distanceFromBottom < SCROLL_CONSTANTS.IMAGE_LOAD_THRESHOLD;
        return isRecent && isNearBottom;
      }

      case "image_load_old":
        return false;

      default:
        return false;
    }
  }

  getScrollBehavior(trigger: ScrollTrigger): ScrollBehavior {
    switch (trigger) {
      case "initial_load":
      case "own_message":
      case "image_load_recent":
      case "image_load_old":
        return "instant";

      case "received_message":
      case "typing_indicator":
      case "chat_updated":
        return "smooth";

      case "manual_button":
        return "auto";

      default:
        return "smooth";
    }
  }
}
