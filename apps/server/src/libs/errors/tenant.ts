/**
 * Custom error classes for tenant operations
 */

export class TenantNotFoundError extends Error {
  constructor(organizationId: string) {
    super(`Tenant not found for organization: ${organizationId}`);
    this.name = "TenantNotFoundError";
  }
}

export class TenantProvisioningError extends Error {
  constructor(
    message: string,
    public cause?: Error,
  ) {
    super(message);
    this.name = "TenantProvisioningError";
  }
}

export class TenantNotActiveError extends Error {
  constructor(
    organizationId: string,
    public status: string,
  ) {
    super(
      `Tenant is not active for organization: ${organizationId}. Current status: ${status}`,
    );
    this.name = "TenantNotActiveError";
  }
}

export class TenantDatabaseError extends Error {
  constructor(
    message: string,
    public cause?: Error,
  ) {
    super(message);
    this.name = "TenantDatabaseError";
  }
}
