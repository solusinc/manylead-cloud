"use client";

import { useEffect, useRef, useState } from "react";
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
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const urlRef = useRef<string | null>(null);

  // Criar blob URL no useEffect
  useEffect(() => {
    let objectUrl: string | null = null;

    try {
      objectUrl = URL.createObjectURL(file);
      urlRef.current = objectUrl;
      // Usar setTimeout para evitar warning de setState síncrono
      const timer = setTimeout(() => {
        setPreviewUrl(objectUrl ?? "");
      }, 0);

      return () => {
        clearTimeout(timer);
        if (urlRef.current) {
          URL.revokeObjectURL(urlRef.current);
        }
      };
    } catch (error) {
      console.error("Error creating blob URL:", error);
      // Usar setTimeout no catch também para evitar warning
      const errorTimer = setTimeout(() => {
        setPreviewUrl("");
      }, 0);
      return () => {
        clearTimeout(errorTimer);
      };
    }
  }, [file]);

  if (!previewUrl) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-lg bg-muted p-8">
        <FileVideo className="h-16 w-16 text-muted-foreground" />
        <div className="text-center">
          <p className="font-medium">{file.name}</p>
          <p className="text-sm text-muted-foreground">
            Erro ao carregar preview
          </p>
        </div>
      </div>
    );
  }

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
      <div className="flex flex-col gap-2">
        <div className="relative max-h-[60vh] max-w-full overflow-hidden rounded-lg">
          <video
            src={previewUrl}
            controls
            autoPlay
            muted
            playsInline
            className="h-auto max-h-[60vh] w-auto"
          >
            <track kind="captions" />
          </video>
        </div>
        <p className="text-center text-sm text-white">{file.name}</p>
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
