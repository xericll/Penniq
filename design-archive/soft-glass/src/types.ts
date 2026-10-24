export type AccountType = 'cash' | 'bank';

export type TransactionType = 'income' | 'expense' | 'transfer';

export interface Transaction {
  id: string;
  amount: number;
  type: TransactionType;
  account: AccountType;
  /** Destination account — transfers only. */
  toAccount?: AccountType;
  reason: string;
  /** Expense category (stored as its canonical Arabic label for backward compatibility). */
  category?: string;
  /** ISO date string */
  timestamp: string;
  /** Balance corrections and opening balances: count toward balances, not toward income/expense stats. */
  kind?: 'adjustment';
}

export type PeriodFilter = 'all' | 'today' | '7days' | 'month';

export type Tab = 'home' | 'activity' | 'insights' | 'settings';

export interface QuickAmounts {
  cash: [number, number];
  bank: [number, number];
}

export type TransferDirection = 'cash_to_bank' | 'bank_to_cash';
