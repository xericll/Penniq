/** The two accounts of the everyday wallet. */
export type AccountType = 'cash' | 'bank';

/**
 * Every place money can sit: the wallet accounts, the vault (money kept aside),
 * 'loans' (money lent to others) and 'owed' (money borrowed from others, so its balance runs negative).
 */
export type Ledger = AccountType | 'vault' | 'loans' | 'owed';

export type TransactionType = 'income' | 'expense' | 'transfer';

export interface Transaction {
  id: string;
  amount: number;
  type: TransactionType;
  account: Ledger;
  /** Destination account — transfers only. */
  toAccount?: Ledger;
  reason: string;
  /** Expense category (stored as its canonical Arabic label for backward compatibility). */
  category?: string;
  /** ISO date string */
  timestamp: string;
  /**
   * 'adjustment' — balance corrections and opening balances: count toward balances, not toward income/expense stats.
   * 'loan' — money lent to someone; 'borrow' — money borrowed from someone;
   * 'repayment' — part of either one being paid back, or taken off without any money moving (see debtId).
   * A 'loan' / 'borrow' that carries a debtId raises that existing debt instead of opening a new one.
   */
  kind?: 'adjustment' | 'loan' | 'borrow' | 'repayment';
  /** The other person — debts and their repayments. */
  person?: string;
  /** Repayments and increases: id of the 'loan' or 'borrow' transaction that opened the debt. */
  debtId?: string;
  /** Id of the workspace the entry belongs to; absent for the first workspace (and every entry from before workspaces). */
  workspace?: string;
}

export type PeriodFilter = 'all' | 'today' | '7days' | 'month';

export type Tab = 'home' | 'activity' | 'wealth' | 'insights' | 'settings';

export interface QuickAmounts {
  cash: [number, number];
  bank: [number, number];
}

export type TransferDirection = 'cash_to_bank' | 'bank_to_cash';

/** A fixed monthly income or cost (rent, salary…) the user adds to the month's entries with one tap. */
export interface Essential {
  id: string;
  name: string;
  amount: number;
  type: 'income' | 'expense';
  account: AccountType;
  /** Expenses only — stored as its canonical Arabic label, like Transaction.category. */
  category?: string;
  /** Workspace the item belongs to; absent for the first one. */
  workspace?: string;
}
