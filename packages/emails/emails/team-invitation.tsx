/** @jsxImportSource react */

import {
  Body,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from "@react-email/components";
import { z } from "zod";
import { Layout } from "./_components/layout";
import { styles } from "./_components/styles";

const BASE_URL = "https://app.manylead.com.br/invite";

export const TeamInvitationSchema = z.object({
  invitedBy: z.string(),
  organizationName: z.string().optional().nullable(),
  token: z.string(),
  baseUrl: z.string().optional(),
});

export type TeamInvitationProps = z.infer<typeof TeamInvitationSchema>;

const TeamInvitationEmail = ({
  token,
  organizationName,
  invitedBy,
  baseUrl = BASE_URL,
}: TeamInvitationProps) => {
  return (
    <Html>
      <Head />
      <Preview>Você foi convidado para participar do Manylead</Preview>
      <Body style={styles.main}>
        <Layout>
          <Heading as="h3">
            Você foi convidado para participar da organização{" "}
            {organizationName ? `"${organizationName}"` : "Manylead"} por{" "}
            {invitedBy}
          </Heading>
          <Text>
            Clique aqui para acessar a organização:{" "}
            <Link style={styles.link} href={`${baseUrl}?token=${token}`}>
              aceitar convite
            </Link>
          </Text>
          <Text>
            Se você ainda não tem uma conta, será necessário criar uma.
          </Text>
        </Layout>
      </Body>
    </Html>
  );
};

TeamInvitationEmail.PreviewProps = {
  token: "token",
  organizationName: "Manylead",
  invitedBy: "usuario@manylead.com.br",
} satisfies TeamInvitationProps;

export default TeamInvitationEmail;
