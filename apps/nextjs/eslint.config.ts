import { defineConfig } from "eslint/config";

import { baseConfig, restrictEnvAccess } from "@manylead/eslint-config/base";
import { nextjsConfig } from "@manylead/eslint-config/nextjs";
import { reactConfig } from "@manylead/eslint-config/react";

export default defineConfig(
  {
    ignores: [".next/**"],
  },
  baseConfig,
  reactConfig,
  nextjsConfig,
  restrictEnvAccess,
);
