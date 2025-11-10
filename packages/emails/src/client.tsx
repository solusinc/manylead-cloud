/** @jsxImportSource react */

import { render } from "@react-email/render";
import { Resend } from "resend";
import TeamInvitationEmail from "../emails/team-invitation";
import type { TeamInvitationProps } from "../emails/team-invitation";

export class EmailClient {
  public readonly client: Resend;

  constructor(opts: { apiKey: string }) {
    this.client = new Resend(opts.apiKey);
  }

  public async sendTeamInvitation(req: TeamInvitationProps & { to: string }) {
    if (process.env.NODE_ENV === "development") {
      console.log(`Sending team invitation email to ${req.to}`);
      return;
    }

    try {
      const html = await render(<TeamInvitationEmail {...req} />);
      const result = await this.client.emails.send({
        from: `${
          req.organizationName ?? "Manylead"
        } <notificacoes@manylead.com.br>`,
        subject: `Você foi convidado para participar da ${
          req.organizationName ?? "Manylead"
        }`,
        to: req.to,
        html,
      });

      if (!result.error) {
        console.log(`Sent team invitation email to ${req.to}`);
        return;
      }

      throw new Error(result.error.message);
    } catch (err) {
      console.error(`Error sending team invitation email to ${req.to}`, err);
    }
  }
}
