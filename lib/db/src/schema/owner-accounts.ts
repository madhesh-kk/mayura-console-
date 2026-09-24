import { pgTable, text, serial, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const ownerAccountsTable = pgTable(
  "owner_accounts",
  {
    id: serial("id").primaryKey(),
    businessId: text("business_id").notNull().unique(),
    username: text("username").notNull(),
    salt: text("salt").notNull(),
    hash: text("hash").notNull(),
    recoverySalt: text("recovery_salt"),
    recoveryHash: text("recovery_hash"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    businessIdIdx: index("idx_business_id").on(table.businessId),
  })
);

export const insertOwnerAccountSchema = createInsertSchema(ownerAccountsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertOwnerAccount = z.infer<typeof insertOwnerAccountSchema>;
export type OwnerAccount = typeof ownerAccountsTable.$inferSelect;
