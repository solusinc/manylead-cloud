import { createSelectSchema } from "drizzle-zod";
import type { z } from "zod";

import { proxyIpAllocation } from "./proxy-ip-allocation";

export const selectProxyIpAllocationSchema = createSelectSchema(proxyIpAllocation);
export type SelectProxyIpAllocation = z.infer<typeof selectProxyIpAllocationSchema>;
