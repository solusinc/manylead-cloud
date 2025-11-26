"use client";

import { useMemo } from "react";
import {
  Section,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "~/components/content/section";
import { FormGeneral } from "~/components/forms/tags/form-general";
import { useTRPC } from "~/lib/trpc/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

// Gera cor baseada em seed (timestamp arredondado para segundo)
// StrictMode re-renders acontecem em ms, então seed será igual
function seededRandomColor(seed: number): string {
  // Simple seeded random usando o seed
  const random = (s: number) => {
    const x = Math.sin(s) * 10000;
    return x - Math.floor(x);
  };

  const hue = Math.floor(random(seed) * 360);
  const saturation = 65 + Math.floor(random(seed + 1) * 20);
  const lightness = 45 + Math.floor(random(seed + 2) * 15);

  const h = hue / 360;
  const s = saturation / 100;
  const l = lightness / 100;

  const hueToRgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = Math.round(hueToRgb(p, q, h + 1 / 3) * 255);
  const g = Math.round(hueToRgb(p, q, h) * 255);
  const b = Math.round(hueToRgb(p, q, h - 1 / 3) * 255);

  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

// Cache do seed por instância de navegação
let lastSeed: number | null = null;
let lastColor: string | null = null;

function getStableRandomColor(): string {
  const currentSeed = Math.floor(Date.now() / 1000);

  // Se o seed mudou (nova navegação), gera nova cor
  if (lastSeed !== currentSeed) {
    lastSeed = currentSeed;
    lastColor = seededRandomColor(currentSeed);
  }

  return lastColor!;
}

export default function Page() {
  const initialColor = useMemo(() => getStableRandomColor(), []);
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  const createMutation = useMutation(
    trpc.tags.create.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.tags.list.queryKey(),
        });
        router.push("/settings/tags");
      },
    }),
  );

  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>Criar etiqueta</SectionTitle>
        </SectionHeader>
        <FormGeneral
          defaultValues={{ color: initialColor }}
          onSubmitAction={async (values) => {
            await createMutation.mutateAsync(values);
          }}
        />
      </Section>
    </SectionGroup>
  );
}
