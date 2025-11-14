import { initAuth } from "@manylead/auth";

import { env } from "~/env";

export const auth = initAuth({
  baseUrl: env.BETTER_AUTH_URL,
  secret: env.AUTH_SECRET,
});
