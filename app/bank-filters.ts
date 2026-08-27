import type { DocumentRecord, FinancialMovement, PaymentAccount } from "./domain";

export type CommittedPeriod = { from: string; to: string } | null;
export const inCommittedPeriod = (occurredAt: string, period: CommittedPeriod) => !period || ((!period.from || occurredAt.slice(0, 10) >= period.from) && (!period.to || occurredAt.slice(0, 10) <= period.to));
export function filterFinancialMovements(rows: FinancialMovement[], period: CommittedPeriod, accountId = "", type = "") { return rows.filter(row => inCommittedPeriod(row.occurredAt, period) && (!accountId || row.paymentMethod === accountId) && (!type || row.type === type)); }
export function filterTransfers<T extends { occurredAt: string; fromAccountId: string; toAccountId: string }>(rows: T[], period: CommittedPeriod, fromAccountId = "", toAccountId = "") { return rows.filter(row => inCommittedPeriod(row.occurredAt, period) && (!fromAccountId || row.fromAccountId === fromAccountId) && (!toAccountId || row.toAccountId === toAccountId)); }
export function bankScopeMetrics(accounts: PaymentAccount[], documents: DocumentRecord[], period: CommittedPeriod, accountId = "", type = "") {
  const currentBalance = accounts.filter(account => !accountId || account.id === accountId || account.code === accountId).reduce((sum, account) => sum + Number(account.balance || 0), 0);
  const relevant = documents.filter(document => document.status === "posted" && inCommittedPeriod(document.occurredAt, period) && (!accountId || document.paymentMethod === accountId) && (!type || document.kind === type));
  const sales = relevant.filter(document => document.kind === "sale").reduce((sum, document) => sum + Number(document.total || 0), 0);
  const expenses = relevant.filter(document => document.kind === "expense").reduce((sum, document) => sum + Number(document.total || 0), 0);
  const profit = relevant.filter(document => document.kind === "sale").reduce((sum, document) => sum + document.lines.reduce((lineSum, line) => lineSum + (Number.isFinite(Number(line.grossProfit)) ? Number(line.grossProfit) : 0), 0), 0);
  return { currentBalance, sales, expenses, profit };
}
