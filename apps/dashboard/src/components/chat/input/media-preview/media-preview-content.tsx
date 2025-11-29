"use client";

import { useEffect, useMemo } from "react";
import { FileVideo } from "lucide-react";

interface MediaPreviewContentProps {
  file: File;
}

/**
 * Renderiza o preview da mídia (imagem ou vídeo)
 */
export function MediaPreviewContent({ file }: MediaPreviewContentProps) {
  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");

  // Criar blob URL usando useMemo
  const previewUrl = useMemo(() => URL.createObjectURL(file), [file]);

  // Cleanup: revogar URL quando componente desmontar ou file mudar
  useEffect(() => {
    // Retornar função de cleanup
    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  if (isImage) {
    return (
      <div className="flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewUrl}
          alt="Preview"
          className="max-h-[70vh] max-w-full rounded-lg object-contain"
          style={{ minHeight: "200px", minWidth: "200px" }}
        />
      </div>
    );
  }

  if (isVideo) {
    return (
      <div className="relative max-h-[60vh] max-w-full overflow-hidden rounded-lg">
        <video
          src={previewUrl}
          controls
          className="h-auto max-h-[60vh] w-auto"
        >
          <track kind="captions" />
        </video>
      </div>
    );
  }

  // Fallback para outros tipos de arquivo
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg bg-muted p-8">
      <FileVideo className="h-16 w-16 text-muted-foreground" />
      <div className="text-center">
        <p className="font-medium">{file.name}</p>
        <p className="text-sm text-muted-foreground">
          {(file.size / 1024 / 1024).toFixed(2)} MB
        </p>
      </div>
    </div>
  );
}
