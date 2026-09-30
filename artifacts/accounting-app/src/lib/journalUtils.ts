import type { LocalRecord } from "./localDb";

export type JournalLine = {
  account: string;
  debit: number;
  credit: number;
  description?: string;
  costCenter?: string;
};

const numeric = (value: unknown) => Number(value ?? 0) || 0;

export function journalLinesOf(row: LocalRecord): JournalLine[] {
  if (Array.isArray(row.journalLines)) {
    return row.journalLines
      .filter((line): line is Record<string, unknown> => Boolean(line) && typeof line === "object")
      .map(line => ({
        account: String(line.account ?? line.accountCode ?? "حساب غير محدد"),
        debit: numeric(line.debit),
        credit: numeric(line.credit),
        description: line.description ? String(line.description) : undefined,
        costCenter: line.costCenter ? String(line.costCenter) : undefined,
      }))
      .filter(line => line.debit !== 0 || line.credit !== 0);
  }
  const debit = numeric(row.debit);
  const credit = numeric(row.credit);
  if (!debit && !credit) return [];
  return [{
    account: String(row.account ?? row.accountName ?? row.name ?? "حساب غير محدد"),
    debit,
    credit,
    description: row.notes ? String(row.notes) : undefined,
  }];
}

export function journalTotals(rows: LocalRecord[]) {
  return rows
    .filter(row => row.postingStatus !== "معكوس" && row.status !== "ملغى")
    .flatMap(row => journalLinesOf(row))
    .reduce((totals, line) => ({
      debit: totals.debit + line.debit,
      credit: totals.credit + line.credit,
    }), { debit: 0, credit: 0 });
}

export function trialBalanceOf(rows: LocalRecord[]) {
  const accounts = new Map<string, { debit: number; credit: number }>();
  for (const row of rows.filter(item => item.postingStatus !== "معكوس" && item.status !== "ملغى")) {
    for (const line of journalLinesOf(row)) {
      const current = accounts.get(line.account) ?? { debit: 0, credit: 0 };
      current.debit += line.debit;
      current.credit += line.credit;
      accounts.set(line.account, current);
    }
  }
  return Array.from(accounts, ([account, totals]) => ({
    account,
    ...totals,
    balance: totals.debit - totals.credit,
  })).sort((a, b) => a.account.localeCompare(b.account, "ar"));
}