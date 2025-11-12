import { Hono } from "hono";
import { healthApi } from "./health";
import { provisioningApi } from "./provisioning";

export const v1 = new Hono();

/**
 * Mount v1 routes
 */
v1.route("/health", healthApi);
v1.route("/provisioning", provisioningApi);
