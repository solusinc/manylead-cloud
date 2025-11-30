import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import type { AnchorState } from "../utils/scroll-types";

export interface UseInfiniteScrollOptions {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  onLoadingStart?: () => void;
  onLoadingEnd?: () => void;
  messageCount: number;
}

export interface UseInfiniteScrollReturn {
  sentinelRef: React.RefObject<HTMLDivElement | null>;
  anchorState: AnchorState;
}

export function useInfiniteScroll(
  scrollViewportRef: React.RefObject<HTMLElement | null>,
  options: UseInfiniteScrollOptions
): UseInfiniteScrollReturn {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const previousMessageCountRef = useRef<number>(0);
  const previousFetchingRef = useRef<boolean>(false);

  const anchorState = useRef<AnchorState>({
    messageId: null,
    offsetFromTop: 0,
    savedScrollTop: 0,
  });

  // Detect when fetching completes and call onLoadingEnd
  useEffect(() => {
    const wasFetching = previousFetchingRef.current;
    const isFetching = options.isFetchingNextPage;

    if (wasFetching && !isFetching) {
      // Fetching just finished
      options.onLoadingEnd?.();
    }

    previousFetchingRef.current = isFetching;
  }, [options]);

  /**
   * Salva anchor message antes de carregar
   */
  const saveAnchor = useCallback(() => {
    const viewport = scrollViewportRef.current;
    if (!viewport) return;

    anchorState.current.savedScrollTop = viewport.scrollTop;

    const viewportRect = viewport.getBoundingClientRect();
    const messageElements = viewport.querySelectorAll("[data-message-id]");

    // Find first visible message
    for (const el of Array.from(messageElements)) {
      const rect = el.getBoundingClientRect();
      if (rect.top >= viewportRect.top && rect.top <= viewportRect.bottom) {
        anchorState.current.messageId = el.getAttribute("data-message-id");
        anchorState.current.offsetFromTop = rect.top - viewportRect.top;
        break;
      }
    }

    previousMessageCountRef.current = options.messageCount;
  }, [scrollViewportRef, options.messageCount]);

  /**
   * Restaura scroll position usando anchor
   */
  const restoreScroll = useCallback(() => {
    const viewport = scrollViewportRef.current;
    const { messageId, offsetFromTop, savedScrollTop } = anchorState.current;

    if (!viewport || !messageId) return;

    // Only restore if messages were added
    if (options.messageCount <= previousMessageCountRef.current) return;

    const anchorElement = viewport.querySelector<HTMLElement>(
      `[data-message-id="${messageId}"]`
    );

    if (anchorElement) {
      const viewportRect = viewport.getBoundingClientRect();
      const anchorRect = anchorElement.getBoundingClientRect();
      const currentOffsetFromTop = anchorRect.top - viewportRect.top;
      const scrollAdjustment = currentOffsetFromTop - offsetFromTop;

      viewport.scrollTop = savedScrollTop + scrollAdjustment;
    }

    // Reset anchor
    anchorState.current = {
      messageId: null,
      offsetFromTop: 0,
      savedScrollTop: 0,
    };
    previousMessageCountRef.current = options.messageCount;
  }, [scrollViewportRef, options.messageCount]);

  /**
   * Setup IntersectionObserver
   */
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    if (!options.hasNextPage || !sentinelRef.current) {
      return;
    }

    // Find viewport
    let viewport = sentinelRef.current.parentElement;
    while (
      viewport &&
      !viewport.hasAttribute("data-radix-scroll-area-viewport")
    ) {
      viewport = viewport.parentElement;
    }

    if (!viewport) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry && entry.isIntersecting && !options.isFetchingNextPage) {
          options.onLoadingStart?.();
          saveAnchor();
          options.fetchNextPage();
        }
      },
      {
        root: viewport,
        rootMargin: "200px 0px 0px 0px",
        threshold: 0,
      }
    );

    observerRef.current.observe(sentinelRef.current);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [options, saveAnchor]);

  /**
   * Restore scroll SYNCHRONOUSLY before paint
   */
  useLayoutEffect(() => {
    restoreScroll();
  }, [restoreScroll]);

  return {
    sentinelRef,
    get anchorState() {
      return anchorState.current;
    },
  };
}
