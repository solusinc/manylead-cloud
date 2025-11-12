import { Hono } from "hono";
import { registerGetProvisioningStatus } from "./get-status";

export const provisioningApi = new Hono();

registerGetProvisioningStatus(provisioningApi);

export default provisioningApi;
