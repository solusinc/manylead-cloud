"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
var env_core_1 = require("@t3-oss/env-core");
var zod_1 = require("zod");
exports.env = (0, env_core_1.createEnv)({
    server: {
        RESEND_API_KEY: zod_1.z.string().min(1),
    },
    runtimeEnv: {
        RESEND_API_KEY: process.env.RESEND_API_KEY,
    },
});
