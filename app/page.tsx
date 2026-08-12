"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Family = {
  id: number;
  name: string;
  createdAt: string;
};

type Expense = {
  id: number;
  familyId: number;
  familyName: string;
  title: string;
  category: string;
  amountCents: number;
  expenseDate: string;
  note: string;
  createdAt: string;
};

type TripData = {
  families: Family[];
  expenses: Expense[];
};

type Settlement = {
  from: string;
  to: string;
  amountCents: number;
};

const categories = ["餐费", "住宿", "交通", "门票", "采购", "其他"];

const categoryEmoji: Record<string, string> = {
  餐费: "🥢",
  住宿: "🏠",
  交通: "🚗",
  门票: "🎫",
  采购: "🛍️",
  其他: "🧾",
};

const money = new Intl.NumberFormat("zh-CN", {
  style: "currency",
  currency: "CNY",
  minimumFractionDigits: 2,
});

function formatMoney(cents: number) {
  return money.format(cents / 100);
}

function today() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function buildSettlements(
  balances: Array<{ name: string; balanceCents: number }>,
): Settlement[] {
  const debtors = balances
    .filter((item) => item.balanceCents < 0)
    .map((item) => ({ ...item, amount: -item.balanceCents }))
    .sort((a, b) => b.amount - a.amount);
  const creditors = balances
    .filter((item) => item.balanceCents > 0)
    .map((item) => ({ ...item, amount: item.balanceCents }))
    .sort((a, b) => b.amount - a.amount);
  const result: Settlement[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amount = Math.min(debtor.amount, creditor.amount);
    if (amount > 0) {
      result.push({ from: debtor.name, to: creditor.name, amountCents: amount });
    }
    debtor.amount -= amount;
    creditor.amount -= amount;
    if (debtor.amount === 0) debtorIndex += 1;
    if (creditor.amount === 0) creditorIndex += 1;
  }

  return result;
}

export default function Home() {
  const [data, setData] = useState<TripData>({ families: [], expenses: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [showFamilyForm, setShowFamilyForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expenseTitle, setExpenseTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(categories[0]);
  const [payerId, setPayerId] = useState("");
  const [expenseDate, setExpenseDate] = useState(today());
  const [note, setNote] = useState("");

  const loadData = useCallback(async () => {
    try {
      const response = await fetch("/api/trip", { cache: "no-store" });
      const payload = (await response.json()) as TripData & { error?: string };
      if (!response.ok) throw new Error(payload.error || "读取数据失败");
      setData({ families: payload.families, expenses: payload.expenses });
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "读取数据失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void loadData(), 0);
    const refresh = window.setInterval(() => void loadData(), 15_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(refresh);
    };
  }, [loadData]);

  const selectedPayerId = payerId || (data.families[0] ? String(data.families[0].id) : "");

  const summary = useMemo(() => {
    const totalCents = data.expenses.reduce((sum, item) => sum + item.amountCents, 0);
    const averageCents = data.families.length
      ? Math.round(totalCents / data.families.length)
      : 0;
    const paidByFamily = new Map<number, number>();
    data.expenses.forEach((item) => {
      paidByFamily.set(item.familyId, (paidByFamily.get(item.familyId) || 0) + item.amountCents);
    });
    const balances = data.families.map((family) => ({
      id: family.id,
      name: family.name,
      paidCents: paidByFamily.get(family.id) || 0,
      balanceCents: (paidByFamily.get(family.id) || 0) - averageCents,
    }));
    const roundingDifference = balances.reduce((sum, item) => sum + item.balanceCents, 0);
    if (roundingDifference !== 0 && balances.length) {
      balances[balances.length - 1].balanceCents -= roundingDifference;
    }
    return {
      totalCents,
      averageCents,
      balances,
      settlements: buildSettlements(balances),
    };
  }, [data]);

  async function mutate(payload: Record<string, unknown>) {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/trip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "保存失败");
      await loadData();
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败，请稍后重试");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function addFamily(event: FormEvent) {
    event.preventDefault();
    const name = familyName.trim();
    if (!name) return;
    if (await mutate({ action: "add_family", name })) {
      setFamilyName("");
      setShowFamilyForm(false);
    }
  }

  async function addExpense(event: FormEvent) {
    event.preventDefault();
    const amountNumber = Number(amount);
    if (!expenseTitle.trim() || !selectedPayerId || !Number.isFinite(amountNumber) || amountNumber <= 0) {
      setMessage("请把费用名称、金额和付款家庭填写完整");
      return;
    }
    if (
      await mutate({
        action: "add_expense",
        title: expenseTitle.trim(),
        category,
        amountCents: Math.round(amountNumber * 100),
        familyId: Number(selectedPayerId),
        expenseDate,
        note: note.trim(),
      })
    ) {
      setExpenseTitle("");
      setAmount("");
      setNote("");
      setExpenseDate(today());
      setShowExpenseForm(false);
    }
  }

  async function removeFamily(family: Family) {
    if (!window.confirm(`确定删除“${family.name}”吗？`)) return;
    await mutate({ action: "delete_family", id: family.id });
  }

  async function removeExpense(expense: Expense) {
    if (!window.confirm(`确定删除“${expense.title}”这笔费用吗？`)) return;
    await mutate({ action: "delete_expense", id: expense.id });
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <div className="hero-topline">
          <span className="brand-mark">DS</span>
          <span>东山岛 · 家庭同行账本</span>
          <button className="refresh-button" onClick={() => void loadData()} aria-label="刷新数据">
            ↻
          </button>
        </div>
        <div className="hero-copy">
          <p className="eyebrow">一程山海，一路同行</p>
          <h1>东山岛之旅<br />短情长</h1>
          <p className="hero-note">每一笔热闹都记得，回程时轻松算清。</p>
        </div>
        <div className="wave" aria-hidden="true" />
      </header>

      <section className="content">
        {message && <div className="notice" role="alert">{message}</div>}

        <section className="summary-card" aria-label="费用总览">
          <div className="summary-main">
            <span>旅途总支出</span>
            <strong>{formatMoney(summary.totalCents)}</strong>
          </div>
          <div className="summary-side">
            <div>
              <span>同行家庭</span>
              <b>{data.families.length} 家</b>
            </div>
            <div>
              <span>每家均摊</span>
              <b>{formatMoney(summary.averageCents)}</b>
            </div>
          </div>
          <p className="summary-rule">当前按所有家庭平均分摊</p>
        </section>

        <section className="section-block">
          <div className="section-heading">
            <div>
              <span className="section-kicker">OUR CREW</span>
              <h2>同行家庭</h2>
            </div>
            <button className="text-button" onClick={() => setShowFamilyForm((value) => !value)}>
              {showFamilyForm ? "取消" : "+ 添加家庭"}
            </button>
          </div>

          {showFamilyForm && (
            <form className="inline-form" onSubmit={addFamily}>
              <label>
                <span>家庭名称</span>
                <input
                  value={familyName}
                  onChange={(event) => setFamilyName(event.target.value)}
                  placeholder="例如：小陈家"
                  maxLength={20}
                />
              </label>
              <button className="primary-button compact" disabled={saving}>保存家庭</button>
            </form>
          )}

          {loading ? (
            <div className="loading-card">正在同步大家的账目…</div>
          ) : data.families.length === 0 ? (
            <button className="empty-card" onClick={() => setShowFamilyForm(true)}>
              <span>🏝️</span>
              <b>先添加同行家庭</b>
              <small>家庭添加好后，就可以开始记账了</small>
            </button>
          ) : (
            <div className="family-list">
              {summary.balances.map((family, index) => (
                <article className="family-card" key={family.id}>
                  <div className="family-index">{String(index + 1).padStart(2, "0")}</div>
                  <div className="family-info">
                    <h3>{family.name}</h3>
                    <span>已付款 {formatMoney(family.paidCents)}</span>
                  </div>
                  <div className={`balance ${family.balanceCents >= 0 ? "positive" : "negative"}`}>
                    <span>{family.balanceCents >= 0 ? "应收" : "应补"}</span>
                    <strong>{formatMoney(Math.abs(family.balanceCents))}</strong>
                  </div>
                  <button className="icon-button" onClick={() => void removeFamily(data.families.find((item) => item.id === family.id)!)} aria-label={`删除${family.name}`}>
                    ×
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>

        {data.families.length > 1 && summary.settlements.length > 0 && (
          <section className="settlement-card">
            <div className="settlement-title">
              <span>✓</span>
              <div>
                <small>最省事的结算方式</small>
                <h2>这样转账就平了</h2>
              </div>
            </div>
            <div className="settlement-list">
              {summary.settlements.map((item, index) => (
                <div className="settlement-row" key={`${item.from}-${item.to}-${index}`}>
                  <b>{item.from}</b>
                  <span>转给 →</span>
                  <b>{item.to}</b>
                  <strong>{formatMoney(item.amountCents)}</strong>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="section-block expenses-section">
          <div className="section-heading">
            <div>
              <span className="section-kicker">TRIP LEDGER</span>
              <h2>费用明细</h2>
            </div>
            <span className="count-pill">{data.expenses.length} 笔</span>
          </div>

          {data.expenses.length === 0 ? (
            <div className="expenses-empty">还没有费用，点击下方按钮记第一笔吧。</div>
          ) : (
            <div className="expense-list">
              {data.expenses.map((expense) => (
                <article className="expense-row" key={expense.id}>
                  <div className={`category-icon category-${categories.indexOf(expense.category)}`}>
                    {categoryEmoji[expense.category] || "🧾"}
                  </div>
                  <div className="expense-info">
                    <h3>{expense.title}</h3>
                    <p>{expense.familyName} · {expense.category} · {expense.expenseDate.slice(5).replace("-", "/")}</p>
                    {expense.note && <small>{expense.note}</small>}
                  </div>
                  <strong className="expense-amount">{formatMoney(expense.amountCents)}</strong>
                  <button className="icon-button" onClick={() => void removeExpense(expense)} aria-label={`删除${expense.title}`}>
                    ×
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>

      <div className="bottom-action">
        <button
          className="primary-button"
          disabled={!data.families.length}
          onClick={() => setShowExpenseForm(true)}
        >
          <span>＋</span> 记一笔费用
        </button>
      </div>

      {showExpenseForm && (
        <div className="modal-backdrop">
          <section className="expense-modal" role="dialog" aria-modal="true" aria-labelledby="expense-title">
            <div className="modal-handle" />
            <div className="modal-heading">
              <div>
                <span className="section-kicker">NEW EXPENSE</span>
                <h2 id="expense-title">记一笔费用</h2>
              </div>
              <button className="close-button" onClick={() => setShowExpenseForm(false)} aria-label="关闭">×</button>
            </div>
            <form className="expense-form" onSubmit={addExpense}>
              <label className="full-field">
                <span>费用名称</span>
                <input value={expenseTitle} onChange={(event) => setExpenseTitle(event.target.value)} placeholder="例如：海鲜大排档晚餐" maxLength={50} />
              </label>
              <label>
                <span>金额（元）</span>
                <input value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" type="number" min="0.01" step="0.01" inputMode="decimal" />
              </label>
              <label>
                <span>谁付款</span>
                <select value={selectedPayerId} onChange={(event) => setPayerId(event.target.value)}>
                  {data.families.map((family) => <option value={family.id} key={family.id}>{family.name}</option>)}
                </select>
              </label>
              <fieldset className="full-field category-field">
                <legend>费用分类</legend>
                <div className="category-options">
                  {categories.map((item) => (
                    <label className={category === item ? "selected" : ""} key={item}>
                      <input type="radio" name="category" value={item} checked={category === item} onChange={() => setCategory(item)} />
                      <span>{categoryEmoji[item]} {item}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <label>
                <span>日期</span>
                <input type="date" value={expenseDate} onChange={(event) => setExpenseDate(event.target.value)} />
              </label>
              <label>
                <span>备注（选填）</span>
                <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="简单说明" maxLength={80} />
              </label>
              <button className="primary-button full-field" disabled={saving}>{saving ? "正在保存…" : "保存这笔费用"}</button>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
