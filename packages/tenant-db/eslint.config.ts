import { defineConfig } from "eslint/config";

import { baseConfig } from "@manylead/eslint-config/base";

export default defineConfig(
  {
    ignores: ["dist/**", "drizzle/**"],
  },
  baseConfig,
);
