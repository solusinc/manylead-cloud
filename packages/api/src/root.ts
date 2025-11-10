import { agentsRouter } from "./router/agents";
import { authRouter } from "./router/auth";
import { departmentsRouter } from "./router/departments";
import { invitationRouter } from "./router/invitation";
import { memberRouter } from "./router/member";
import { organizationRouter } from "./router/organization";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  organization: organizationRouter,
  invitation: invitationRouter,
  member: memberRouter,
  departments: departmentsRouter,
  agents: agentsRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
