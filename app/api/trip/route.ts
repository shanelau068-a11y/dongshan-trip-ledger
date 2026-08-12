import { desc, eq, sql } from "drizzle-orm";
import { getD1, getDb } from "../../../db";
import { expenses, families } from "../../../db/schema";

async function ensureSchema() {
  const d1 = getD1();
  await d1.batch([
    d1.prepare(`CREATE TABLE IF NOT EXISTS families (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    d1.prepare(`CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      family_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
      expense_date TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE RESTRICT
    )`),
    d1.prepare("CREATE INDEX IF NOT EXISTS idx_expenses_family_id ON expenses(family_id)"),
    d1.prepare("CREATE INDEX IF NOT EXISTS idx_expenses_date_id ON expenses(expense_date DESC, id DESC)"),
  ]);
}

function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "操作失败";
  if (message.includes("UNIQUE constraint failed")) return "这个家庭名称已经存在";
  if (message.includes("no such table")) return "账本正在初始化，请刷新后再试";
  return message;
}

export async function GET() {
  try {
    await ensureSchema();
    const db = getDb();
    const [familyRows, expenseRows] = await Promise.all([
      db.select().from(families).orderBy(families.id),
      db
        .select({
          id: expenses.id,
          familyId: expenses.familyId,
          familyName: families.name,
          title: expenses.title,
          category: expenses.category,
          amountCents: expenses.amountCents,
          expenseDate: expenses.expenseDate,
          note: expenses.note,
          createdAt: expenses.createdAt,
        })
        .from(expenses)
        .innerJoin(families, eq(expenses.familyId, families.id))
        .orderBy(desc(expenses.expenseDate), desc(expenses.id)),
    ]);
    return Response.json({ families: familyRows, expenses: expenseRows });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const payload = (await request.json()) as Record<string, unknown>;
    const action = String(payload.action || "");
    const db = getDb();

    if (action === "add_family") {
      const name = String(payload.name || "").trim();
      if (!name || name.length > 20) {
        return Response.json({ error: "家庭名称需要填写，且不超过20个字" }, { status: 400 });
      }
      const [family] = await db.insert(families).values({ name }).returning();
      return Response.json({ family }, { status: 201 });
    }

    if (action === "delete_family") {
      const id = Number(payload.id);
      if (!Number.isInteger(id)) return Response.json({ error: "家庭信息无效" }, { status: 400 });
      const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(expenses).where(eq(expenses.familyId, id));
      if (Number(count) > 0) {
        return Response.json({ error: "这个家庭已有费用，请先删除相关费用后再删除家庭" }, { status: 409 });
      }
      await db.delete(families).where(eq(families.id, id));
      return Response.json({ ok: true });
    }

    if (action === "add_expense") {
      const familyId = Number(payload.familyId);
      const title = String(payload.title || "").trim();
      const category = String(payload.category || "其他");
      const amountCents = Number(payload.amountCents);
      const expenseDate = String(payload.expenseDate || "");
      const note = String(payload.note || "").trim();
      if (!Number.isInteger(familyId) || !title || title.length > 50 || !Number.isInteger(amountCents) || amountCents <= 0 || amountCents > 100_000_000 || !/^\d{4}-\d{2}-\d{2}$/.test(expenseDate) || note.length > 80) {
        return Response.json({ error: "费用信息不完整或金额不正确" }, { status: 400 });
      }
      const [expense] = await db.insert(expenses).values({ familyId, title, category, amountCents, expenseDate, note }).returning();
      return Response.json({ expense }, { status: 201 });
    }

    if (action === "delete_expense") {
      const id = Number(payload.id);
      if (!Number.isInteger(id)) return Response.json({ error: "费用信息无效" }, { status: 400 });
      await db.delete(expenses).where(eq(expenses.id, id));
      return Response.json({ ok: true });
    }

    return Response.json({ error: "不支持的操作" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}
