"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@manylead/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@manylead/ui/dialog";
import { cn } from "@manylead/ui";

interface ChatImageLightboxProps {
  images: {
    url: string;
    alt?: string;
  }[];
  initialIndex: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Lightbox fullscreen para visualizar imagens com navegação
 * Estilo WhatsApp Web usando Dialog do shadcn
 */
export function ChatImageLightbox({
  images,
  initialIndex,
  open,
  onOpenChange,
}: ChatImageLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  // Reset index when dialog opens
  useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex);
    }
  }, [open, initialIndex]);

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  }, [images.length]);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  }, [images.length]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goToPrevious();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goToNext();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, goToPrevious, goToNext]);

  const currentImage = images[currentIndex];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="!max-w-none !w-screen !h-screen !p-0 !m-0 !gap-0 !border-0 !rounded-none !translate-x-0 !translate-y-0 top-0 left-0 !transform-none flex flex-col bg-black/50 dark:bg-black/50 backdrop-blur-sm [&>button]:!text-white [&>button:hover]:!text-white/80 [&>button>svg]:!text-white [&>button]:!z-50"
      >
        {/* Header - fixo no topo */}
        <DialogHeader className="shrink-0 px-6 py-4 flex-row items-center justify-between space-y-0 absolute top-0 left-0 right-0 z-20 [&_button]:text-white [&_button]:hover:text-white/80 [&_button_svg]:text-white">
          <DialogTitle className="text-base font-normal text-white">
            {currentIndex + 1} / {images.length}
          </DialogTitle>
          {/* Close button já vem do DialogContent */}
        </DialogHeader>

        {/* Image container - ocupa toda a tela com margem para thumbnails */}
        <div className="absolute inset-0 flex items-center justify-center pb-24">
          {/* Image */}
          {currentImage && (
            <div className="relative w-full h-full flex items-center justify-center p-20">
              <div className="relative w-full h-full max-w-7xl">
                <Image
                  src={currentImage.url}
                  alt={currentImage.alt ?? `Image ${currentIndex + 1}`}
                  fill
                  className="object-contain"
                  priority
                  sizes="100vw"
                />
              </div>
            </div>
          )}
        </div>

        {/* Navigation buttons - nas extremidades */}
        {images.length > 1 && (
          <>
            {/* Previous button */}
            <button
              onClick={goToPrevious}
              className="absolute left-6 top-1/2 -translate-y-1/2 z-20 text-white hover:text-white/80"
            >
              <ChevronLeft className="h-8 w-8" />
            </button>

            {/* Next button */}
            <button
              onClick={goToNext}
              className="absolute right-6 top-1/2 -translate-y-1/2 z-20 text-white hover:text-white/80"
            >
              <ChevronRight className="h-8 w-8" />
            </button>
          </>
        )}

        {/* Thumbnails - fixo na parte inferior */}
        {images.length > 1 && images.length <= 10 && (
          <div className="absolute bottom-0 left-0 right-0 z-20 flex items-center justify-center gap-2 px-6 py-4">
            {images.map((img, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={cn(
                  "relative h-16 w-16 overflow-hidden rounded-md border-2 transition-all",
                  index === currentIndex
                    ? "border-white scale-110"
                    : "border-white/30 opacity-60 hover:opacity-100"
                )}
              >
                <Image
                  src={img.url}
                  alt={img.alt ?? `Thumbnail ${index + 1}`}
                  fill
                  className="object-cover"
                  sizes="64px"
                />
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
