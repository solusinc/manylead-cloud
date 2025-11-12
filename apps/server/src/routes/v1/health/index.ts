import { Hono } from "hono";
import { registerGetHealth } from "./get";

export const healthApi = new Hono();

registerGetHealth(healthApi);

export default healthApi;
