"use client";

import { Check, Copy } from "lucide-react";

import { Button } from "@manylead/ui";

import {
  FormCard,
  FormCardContent,
  FormCardDescription,
  FormCardFooter,
  FormCardFooterInfo,
  FormCardHeader,
  FormCardTitle,
} from "~/components/forms/form-card";
import { useCopyToClipboard } from "~/hooks/use-copy-to-clipboard";

interface FormValues {
  slug: string;
}

export function FormSlug({ defaultValues }: { defaultValues?: FormValues }) {
  const { copy, isCopied } = useCopyToClipboard();

  return (
    <FormCard>
      <FormCardHeader>
        <FormCardTitle>Slug</FormCardTitle>
        <FormCardDescription>
          O identificador único da sua organização.
        </FormCardDescription>
      </FormCardHeader>
      <FormCardContent>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            copy(defaultValues?.slug ?? "slug desconhecido", {
              successMessage: "Slug copiado para a área de transferência",
            })
          }
        >
          {defaultValues?.slug ?? "slug desconhecido"}
          {isCopied ? (
            <Check size={16} className="text-muted-foreground" />
          ) : (
            <Copy size={16} className="text-muted-foreground" />
          )}
        </Button>
      </FormCardContent>
      <FormCardFooter className="*:last:ml-0">
        <FormCardFooterInfo>
          Usado ao interagir com a API. Entre em contato se precisar alterá-lo.
        </FormCardFooterInfo>
      </FormCardFooter>
    </FormCard>
  );
}
