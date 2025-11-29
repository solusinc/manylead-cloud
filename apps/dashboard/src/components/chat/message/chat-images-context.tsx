"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useState, useCallback } from "react";
import { ChatImageLightbox } from "./chat-image-lightbox";

interface ChatImage {
  url: string;
  alt: string;
  messageId: string;
}

interface ChatImagesContextValue {
  images: ChatImage[];
  registerImage: (image: ChatImage) => void;
  openLightbox: (messageId: string) => void;
}

const ChatImagesContext = createContext<ChatImagesContextValue | null>(null);

export function ChatImagesProvider({ children }: { children: ReactNode }) {
  const [images, setImages] = useState<ChatImage[]>([]);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [initialIndex, setInitialIndex] = useState(0);

  const registerImage = useCallback((image: ChatImage) => {
    setImages((prev) => {
      // Evitar duplicatas
      const exists = prev.some((img) => img.messageId === image.messageId);
      if (exists) return prev;
      return [...prev, image];
    });
  }, []);

  const openLightbox = useCallback((messageId: string) => {
    setImages((currentImages) => {
      const index = currentImages.findIndex((img) => img.messageId === messageId);
      if (index !== -1) {
        setInitialIndex(index);
        setLightboxOpen(true);
      }
      return currentImages;
    });
  }, []);

  const value = { images, registerImage, openLightbox };

  return (
    <ChatImagesContext.Provider value={value}>
      {children}
      {images.length > 0 && (
        <ChatImageLightbox
          images={images}
          initialIndex={initialIndex}
          open={lightboxOpen}
          onOpenChange={setLightboxOpen}
        />
      )}
    </ChatImagesContext.Provider>
  );
}

export function useChatImages() {
  const context = useContext(ChatImagesContext);
  if (!context) {
    throw new Error("useChatImages must be used within ChatImagesProvider");
  }
  return context;
}
