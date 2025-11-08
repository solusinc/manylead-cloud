import slugifyLib from "slugify";
import type { ConnectionParams, RetryOptions } from "./types";

export function generateSlug(name: string): string {
  return slugifyLib(name, {
    lower: true,
    strict: true,
    trim: true,
  });
}

export function generateUniqueSlug(
  name: string,
  existingSlugs: string[],
): string {
  const baseSlug = generateSlug(name);
  let slug = baseSlug;
  let counter = 1;

  while (existingSlugs.includes(slug)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
}

export function generateDatabaseName(organizationId: string): string {
  const cleanId = organizationId.replace(/-/g, "");
  return `org_${cleanId}`;
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

export function isValidDatabaseName(name: string): boolean {
  return /^[a-z_][a-z0-9_]*$/.test(name) && name.length <= 63;
}

export function buildConnectionString(params: ConnectionParams): string {
  const { host, port, database, user, password } = params;
  return `postgresql://${user}:${password}@${host}:${port}/${database}`;
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options?: RetryOptions,
): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? 3;
  const delayMs = options?.delayMs ?? 1000;
  const backoffMultiplier = options?.backoffMultiplier ?? 2;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxAttempts) {
        throw lastError;
      }

      const delay = delayMs * Math.pow(backoffMultiplier, attempt - 1);
      console.log(
        `[Retry] Attempt ${attempt}/${maxAttempts} failed. Retrying in ${delay}ms...`,
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error("Retry failed after all attempts");
}
