import { index, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { customAlphabet } from "nanoid";

const nanoid = customAlphabet("0123456789abcdef", 10);

/**
 * Organization table (Better Auth plugin)
 *
 * Multi-tenant organizations managed by Better Auth
 */
export const organization = pgTable(
  "organization",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    logo: text("logo"),

    // Instance Code (para comunicação inter-organizações)
    instanceCode: varchar("instance_code", { length: 50 })
      .notNull()
      .unique()
      .$defaultFn(() => `manylead-${nanoid()}`),
    // Formato: manylead-477a286676 (sem hífen no ID, só lowercase hex)

    createdAt: timestamp("created_at").notNull(),
    metadata: text("metadata"),
  },
  (table) => [index("organization_instance_code_idx").on(table.instanceCode)],
);
