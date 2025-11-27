"use client";

import { useQueryClient } from "@tanstack/react-query";

import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "~/components/content/section";
import { FormCardGroup } from "~/components/forms/form-card";
import { AvatarUpload } from "~/components/forms/user/avatar-upload";
import { FormUserProfile } from "~/components/forms/user/form-profile";
import { FormChangePassword } from "~/components/forms/user/form-change-password";
import { useSession } from "~/lib/auth/client";
import { authClient } from "~/lib/auth/client";

// Tradução de mensagens de erro do better-auth
const translateAuthError = (message: string): string => {
  const translations: Record<string, string> = {
    "Invalid password": "Senha atual incorreta",
    "Invalid current password": "Senha atual incorreta",
    "Password is too short": "A senha é muito curta",
    "Password is too weak": "A senha é muito fraca",
    "User not found": "Usuário não encontrado",
    "Invalid credentials": "Credenciais inválidas",
    "Session expired": "Sessão expirada",
    "Unauthorized": "Não autorizado",
  };

  return translations[message] ?? message;
};

export default function Page() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  if (!session?.user) return null;

  const user = session.user;

  const handleUpdateProfile = async (values: { name: string }) => {
    const result = await authClient.updateUser({
      name: values.name,
    });

    if (result.error) {
      throw new Error(
        translateAuthError(result.error.message ?? "Erro ao atualizar perfil"),
      );
    }

    // Invalidate session to refresh user data
    await queryClient.invalidateQueries({ queryKey: ["session"] });
  };

  const handleChangePassword = async (values: {
    currentPassword: string;
    newPassword: string;
  }) => {
    const result = await authClient.changePassword({
      currentPassword: values.currentPassword,
      newPassword: values.newPassword,
      revokeOtherSessions: false, // Manter a sessão atual ativa
    });

    if (result.error) {
      throw new Error(
        translateAuthError(result.error.message ?? "Erro ao alterar senha"),
      );
    }

    // Atualizar sessão após trocar senha
    await queryClient.invalidateQueries({ queryKey: ["session"] });
  };

  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>Meus dados</SectionTitle>
          <SectionDescription>
            Modifique suas informações pessoais e senha de acesso.
          </SectionDescription>
        </SectionHeader>
        <AvatarUpload
          currentImage={user.image}
          userName={user.name}
          className="mb-6"
        />
        <FormCardGroup>
          <FormUserProfile
            defaultValues={{
              name: user.name,
              email: user.email,
            }}
            onSubmit={handleUpdateProfile}
          />
          <FormChangePassword onSubmit={handleChangePassword} />
        </FormCardGroup>
      </Section>
    </SectionGroup>
  );
}
