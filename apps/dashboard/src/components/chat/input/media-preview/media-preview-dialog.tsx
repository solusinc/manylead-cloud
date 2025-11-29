"use client";

import { useEffect, useRef, useState } from "react";
import { X, Send } from "lucide-react";

import { Button } from "@manylead/ui/button";
import { Input } from "@manylead/ui/input";

import { MediaPreviewContent } from "./media-preview-content";

interface MediaPreviewDialogProps {
  file: File;
  onSend: (caption: string) => void;
  onClose: () => void;
  isLoading?: boolean;
  uploadProgress?: number;
}

/**
 * Dialog de preview de mídia antes de enviar
 * Aparece como overlay sobre o chat com preview da mídia e campo para caption
 */
export function MediaPreviewDialog({
  file,
  onSend,
  onClose,
  isLoading = false,
  uploadProgress = 0,
}: MediaPreviewDialogProps) {
  const [caption, setCaption] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus no input quando o dialog abrir
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = () => {
    onSend(caption);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="flex h-full w-full flex-col">
        {/* Header */}
        <div className="flex items-center justify-between bg-white px-6 py-4 dark:bg-black">
          <h2 className="text-lg font-semibold">Enviar Mídia</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            disabled={isLoading}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Media Preview */}
        <div className="flex flex-1 items-center justify-center overflow-hidden p-6">
          <MediaPreviewContent file={file} />
        </div>

        {/* Footer */}
        <div className="bg-white px-6 py-4 dark:bg-black">
          {/* Upload Progress */}
          {isLoading && (
            <div className="mb-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Enviando mídia...</span>
                <span className="font-medium">{uploadProgress}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Input
              ref={inputRef}
              type="text"
              placeholder="Mensagem (opcional)"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              onClick={handleSend}
              disabled={isLoading}
              size="icon"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
