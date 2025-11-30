import { useCallback, useMemo, useRef, useState } from "react";
import { ScrollRuleEngine, SCROLL_CONSTANTS } from "../utils/scroll-rules";
import type { ScrollContext, ScrollTrigger } from "../utils/scroll-types";

export interface UseScrollManagerReturn {
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  scrollViewportRef: React.RefObject<HTMLElement | null>;
  showScrollButton: boolean;
  scrollToBottom: (trigger: ScrollTrigger, context?: Partial<ScrollContext>) => void;
  getScrollContext: () => Omit<ScrollContext, "isLoadingOlder" | "messageIndex" | "totalMessages">;
  setupScrollListener: (containerRef: HTMLDivElement | null) => void;
}

export function useScrollManager(): UseScrollManagerReturn {
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const scrollViewportRef = useRef<HTMLElement | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const ruleEngine = useMemo(() => new ScrollRuleEngine(), []);

  /**
   * Calcula contexto atual de scroll
   */
  const getScrollContext = useCallback(() => {
    const viewport = scrollViewportRef.current;
    if (!viewport) {
      return {
        isNearBottom: false,
        distanceFromBottom: 0,
      };
    }

    const distanceFromBottom =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;

    return {
      isNearBottom: distanceFromBottom < SCROLL_CONSTANTS.NEAR_BOTTOM_THRESHOLD,
      distanceFromBottom,
    };
  }, []);

  /**
   * Scroll to bottom com regras
   */
  const scrollToBottom = useCallback(
    (trigger: ScrollTrigger, contextOverrides: Partial<ScrollContext> = {}) => {
      const baseContext = getScrollContext();
      const fullContext: ScrollContext = {
        ...baseContext,
        isLoadingOlder: false,
        messageIndex: 0,
        totalMessages: 0,
        ...contextOverrides,
      };

      if (!ruleEngine.shouldScroll(trigger, fullContext)) {
        return;
      }

      const behavior = ruleEngine.getScrollBehavior(trigger);
      messagesEndRef.current?.scrollIntoView({ behavior, block: "end" });
    },
    [ruleEngine, getScrollContext]
  );

  /**
   * Setup scroll listener
   */
  const setupScrollListener = useCallback((container: HTMLDivElement | null) => {
    if (!container) return;

    // Find Radix ScrollArea viewport
    let scrollViewport = container.querySelector<HTMLElement>(
      "[data-radix-scroll-area-viewport]"
    );

    if (!scrollViewport) {
      let parent = container.parentElement;
      while (parent && !scrollViewport) {
        scrollViewport = parent.querySelector<HTMLElement>(
          "[data-radix-scroll-area-viewport]"
        );
        parent = parent.parentElement;
      }
    }

    if (!scrollViewport) return;

    scrollViewportRef.current = scrollViewport;

    const handleScroll = () => {
      const distanceFromBottom =
        scrollViewport.scrollHeight -
        scrollViewport.scrollTop -
        scrollViewport.clientHeight;
      setShowScrollButton(distanceFromBottom > SCROLL_CONSTANTS.SCROLL_BUTTON_THRESHOLD);
    };

    handleScroll();
    scrollViewport.addEventListener("scroll", handleScroll);

    return () => {
      scrollViewport.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return {
    messagesEndRef,
    scrollViewportRef,
    showScrollButton,
    scrollToBottom,
    getScrollContext,
    setupScrollListener,
  };
}
