"use client";

import { useEffect, useRef, useState } from "react";
import { FileVideo } from "lucide-react";
import { formatFileSize } from "@manylead/shared/constants";
import { getDocumentType } from "~/lib/document-type-map";

interface MediaPreviewContentProps {
  file: File;
}

/**
 * Renderiza o preview da mídia (imagem, vídeo ou documento)
 */
export function MediaPreviewContent({ file }: MediaPreviewContentProps) {
  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");
  const isDocument = !isImage && !isVideo;
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

  // Preview de documento
  if (isDocument) {
    const docType = getDocumentType(file.type);
    const Icon = docType.icon;

    return (
      <div className="flex flex-col items-center justify-center gap-8">
        <div className="flex items-center justify-center">
          <Icon className="h-48 w-48" />
        </div>

        <div className="text-center w-full max-w-md px-4">
          <p className="text-lg font-medium text-white truncate">
            {file.name}
          </p>
          <p className="text-sm text-white/70 mt-1">
            {docType.label} • {formatFileSize(file.size)}
          </p>
        </div>
      </div>
    );
  }

  // Fallback
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg bg-muted p-8">
      <FileVideo className="h-16 w-16 text-muted-foreground" />
      <div className="text-center">
        <p className="font-medium">{file.name}</p>
        <p className="text-sm text-muted-foreground">
          {formatFileSize(file.size)}
        </p>
      </div>
    </div>
  );
}
