export { default as TeamInvitationEmail } from "../emails/team-invitation";
export type { TeamInvitationProps } from "../emails/team-invitation";

export { sendEmail, sendEmailHtml, sendBatchEmailHtml } from "./send";

export { EmailClient } from "./client";
