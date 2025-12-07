"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UseInputContentOptions {
  onTypingStart?: () => void;
  onTypingStop?: () => void;
}

/**
 * Manages input content state, typing indicators, and quick reply detection
 * Extracted from chat-input.tsx (lines 420-470)
 */
export function useInputContent(options: UseInputContentOptions = {}) {
  const { onTypingStart, onTypingStop } = options;

  const [content, setContent] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [rows, setRows] = useState(1);
  const [quickReplyOpen, setQuickReplyOpen] = useState(false);
  const [quickReplySearch, setQuickReplySearch] = useState("");

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleContentChange = useCallback(
    (value: string) => {
      setContent(value);

      // Detectar "/" para quick reply
      // Ativar quando: "/" está no início ou após um espaço/quebra de linha
      const slashRegex = /(?:^|\s)\/([\w]*)$/;
      const slashMatch = slashRegex.exec(value);
      if (slashMatch) {
        const searchTerm = slashMatch[1] ?? "";
        setQuickReplySearch(searchTerm);
        setQuickReplyOpen(true);
      } else {
        setQuickReplyOpen(false);
        setQuickReplySearch("");
      }

      // Detectar número de linhas VISUAIS (não apenas \n)
      // Usa requestAnimationFrame para garantir que o textarea já foi renderizado
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          const lineHeight = 24; // altura de uma linha em pixels (aproximado)
          const scrollHeight = textareaRef.current.scrollHeight;
          const calculatedRows = Math.ceil(scrollHeight / lineHeight);
          setRows(calculatedRows);
        }
      });

      // Typing indicator logic - envia apenas 1x no início
      if (value.trim() && !isTyping) {
        onTypingStart?.();
        setIsTyping(true);
      }

      // Reset timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Stop typing after 3 seconds of inactivity
      if (value.trim()) {
        typingTimeoutRef.current = setTimeout(() => {
          if (isTyping) {
            onTypingStop?.();
            setIsTyping(false);
          }
        }, 3000);
      } else if (isTyping) {
        onTypingStop?.();
        setIsTyping(false);
      }
    },
    [isTyping, onTypingStart, onTypingStop]
  );

  const clearContent = useCallback(() => {
    setContent("");
    setRows(1);
  }, []);

  const closeQuickReply = useCallback(() => {
    setQuickReplyOpen(false);
    setQuickReplySearch("");
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (isTyping) {
        onTypingStop?.();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    content,
    setContent,
    handleContentChange,
    clearContent,
    rows,
    isTyping,
    quickReplyOpen,
    quickReplySearch,
    closeQuickReply,
    textareaRef,
  };
}
