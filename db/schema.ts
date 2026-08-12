import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const families = sqliteTable("families", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const tripSettings = sqliteTable("trip_settings", {
  id: integer("id").primaryKey(),
  title: text("title").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const expenses = sqliteTable(
  "expenses",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    familyId: integer("family_id").notNull().references(() => families.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    category: text("category").notNull(),
    amountCents: integer("amount_cents").notNull(),
    expenseDate: text("expense_date").notNull(),
    note: text("note").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_expenses_family_id").on(table.familyId),
    index("idx_expenses_date_id").on(table.expenseDate, table.id),
  ],
);
