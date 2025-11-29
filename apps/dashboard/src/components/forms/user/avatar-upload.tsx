"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Trash2, User } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@manylead/ui";
import { Button } from "@manylead/ui/button";
import { MEDIA_LIMITS } from "@manylead/shared/constants";

import { useSession } from "~/lib/auth/client";
import { useTRPC } from "~/lib/trpc/react";

interface AvatarUploadProps {
  currentImage?: string | null;
  userName: string;
  className?: string;
}

export function AvatarUpload({
  currentImage,
  userName,
  className,
}: AvatarUploadProps) {
  const trpc = useTRPC();
  const { refetch: refetchSession } = useSession();
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Mutation para obter URL de upload
  const getUploadUrlMutation = useMutation(
    trpc.user.getAvatarUploadUrl.mutationOptions(),
  );

  // Mutation para atualizar avatar no banco
  const updateAvatarMutation = useMutation(
    trpc.user.updateAvatar.mutationOptions({
      onSuccess: () => {
        refetchSession();
        toast.success("Foto atualizada com sucesso");
        setPreviewUrl(null);
      },
      onError: (error) => {
        toast.error(error.message || "Erro ao atualizar foto");
      },
    }),
  );

  // Mutation para remover avatar
  const removeAvatarMutation = useMutation(
    trpc.user.removeAvatar.mutationOptions({
      onSuccess: () => {
        refetchSession();
        toast.success("Foto removida com sucesso");
        setPreviewUrl(null);
      },
      onError: (error) => {
        toast.error(error.message || "Erro ao remover foto");
      },
    }),
  );

  const uploadFile = useCallback(
    async (file: File) => {
      setIsUploading(true);

      try {
        // 1. Obter URL de upload assinada
        const { uploadUrl, publicUrl } =
          await getUploadUrlMutation.mutateAsync({
            fileName: file.name,
            mimeType: file.type,
          });

        // 2. Fazer upload direto para R2
        const uploadResponse = await fetch(uploadUrl, {
          method: "PUT",
          body: file,
          headers: {
            "Content-Type": file.type,
          },
        });

        if (!uploadResponse.ok) {
          throw new Error("Falha ao enviar arquivo");
        }

        // 3. Atualizar avatar no banco
        await updateAvatarMutation.mutateAsync({
          imageUrl: publicUrl,
        });
      } catch (error) {
        console.error("Upload error:", error);
        toast.error("Erro ao fazer upload da foto");
        setPreviewUrl(null);
      } finally {
        setIsUploading(false);
      }
    },
    [getUploadUrlMutation, updateAvatarMutation],
  );

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (file) {
        // Mostrar preview
        const reader = new FileReader();
        reader.onload = () => {
          setPreviewUrl(reader.result as string);
        };
        reader.readAsDataURL(file);

        // Fazer upload
        void uploadFile(file);
      }
    },
    [uploadFile],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: MEDIA_LIMITS.IMAGE.ALLOWED_TYPES.reduce(
      (acc, type) => {
        acc[type] = [];
        return acc;
      },
      {} as Record<string, string[]>,
    ),
    maxFiles: 1,
    maxSize: MEDIA_LIMITS.IMAGE.MAX_SIZE_BYTES,
    disabled: isUploading,
  });

  const handleRemove = () => {
    removeAvatarMutation.mutate();
  };

  const displayImage = previewUrl ?? currentImage;
  const hasImage = !!displayImage;

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <div
        {...getRootProps()}
        className={cn(
          "relative flex h-40 w-40 cursor-pointer items-center justify-center rounded-full border-2 border-dashed transition-colors",
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50",
          isUploading && "pointer-events-none opacity-50",
        )}
      >
        <input {...getInputProps()} />

        {isUploading ? (
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        ) : hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={displayImage}
            alt={userName}
            className="h-full w-full rounded-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <User className="h-10 w-10" />
            <span className="text-xs">adicionar foto</span>
          </div>
        )}
      </div>

      {hasImage && !isUploading && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            handleRemove();
          }}
          disabled={removeAvatarMutation.isPending}
          className="text-muted-foreground hover:text-destructive"
        >
          {removeAvatarMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="mr-2 h-4 w-4" />
          )}
          Remover foto
        </Button>
      )}
    </div>
  );
}
