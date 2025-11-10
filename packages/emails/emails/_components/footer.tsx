/** @jsxImportSource react */

import { Link, Section, Text } from "@react-email/components";
import { styles } from "./styles";

export function Footer() {
  return (
    <Section style={{ textAlign: "center" }}>
      <Text>
        <Link style={styles.link} href="https://manylead.com.br">
          Página Inicial
        </Link>{" "}
        ・{" "}
        <Link style={styles.link} href="mailto:contato@manylead.com.br">
          Falar com Suporte
        </Link>
      </Text>

      <Text>Manylead</Text>
    </Section>
  );
}
