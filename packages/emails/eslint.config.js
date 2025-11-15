"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var config_1 = require("eslint/config");
var base_1 = require("@manylead/eslint-config/base");
exports.default = (0, config_1.defineConfig)({
    ignores: ["dist/**"],
}, base_1.baseConfig);
