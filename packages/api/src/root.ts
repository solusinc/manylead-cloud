import { agentsRouter } from "./router/agents";
import { attachmentsRouter } from "./router/attachments";
import { authRouter } from "./router/auth";
import { channelsRouter } from "./router/channels";
import { chatsRouter } from "./router/chats";
import { contactsRouter } from "./router/contacts";
import { departmentsRouter } from "./router/departments";
import { endingsRouter } from "./router/endings";
import { invitationRouter } from "./router/invitation";
import { memberRouter } from "./router/member";
import { messagesRouter } from "./router/messages";
import { organizationRouter } from "./router/organization";
import { organizationSettingsRouter } from "./router/organization-settings";
import { proxySettingsRouter } from "./router/proxy-settings";
import { quickRepliesRouter } from "./router/quick-replies";
import { scheduledMessagesRouter } from "./router/scheduled-messages";
import { tagsRouter } from "./router/tags";
import { userRouter } from "./router/user";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  user: userRouter,
  organization: organizationRouter,
  organizationSettings: organizationSettingsRouter,
  proxySettings: proxySettingsRouter,
  invitation: invitationRouter,
  member: memberRouter,
  departments: departmentsRouter,
  agents: agentsRouter,
  channels: channelsRouter,
  contacts: contactsRouter,
  chats: chatsRouter,
  messages: messagesRouter,
  attachments: attachmentsRouter,
  tags: tagsRouter,
  quickReplies: quickRepliesRouter,
  scheduledMessages: scheduledMessagesRouter,
  endings: endingsRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
