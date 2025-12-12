/**
 * Proxy IP Allocation Status
 */
export const proxyIpAllocationStatus = ["active", "released"] as const;
export type ProxyIpAllocationStatus = (typeof proxyIpAllocationStatus)[number];
