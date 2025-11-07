import { defineConfig } from "eslint/config";

import { baseConfig } from "@manylead/eslint-config/base";
import { reactConfig } from "@manylead/eslint-config/react";

export default defineConfig(
  {
    ignores: ["dist/**"],
  },
  baseConfig,
  reactConfig,
);
