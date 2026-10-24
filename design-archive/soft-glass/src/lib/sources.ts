import type { TransferDirection } from '../types';

/** Defaults are stored in Arabic (as before); PHRASES translates them for display. */
export const DEFAULT_INCOME_SOURCES = [
  'راتب شهري',
  'شغل جانبي',
  'من الشركة',
  'سداد ديون / استرجاع',
  'عمل حر',
  'هدية',
  'بيع غرض',
  'أرباح واستثمارات',
];

export const DEFAULT_EXPENSE_SOURCES = [
  'تسوق وبقالة',
  'فواتير ومصاريف',
  'مطعم وكافيه',
  'مواصلات وبنزين',
  'إيجار سكن',
  'سداد ديون والتزامات',
  'تسوق شخصي',
  'صحة وأدوية',
];

export const TRANSFER_REASONS: Record<TransferDirection, string[]> = {
  cash_to_bank: ['إيداع فائض الكاش', 'إيداع إيرادات', 'تحويل للادخار', 'سداد رصيد', 'تغذية الحساب'],
  bank_to_cash: ['سحب لمصروف الأسبوع', 'سحب من الصراف', 'مصاريف تسوق', 'كاش طوارئ', 'نفقات شخصية'],
};

export const DEFAULT_REASON = {
  income: 'دخل عام',
  cash_to_bank: 'إيداع من الكاش للبنك',
  bank_to_cash: 'سحب من البنك للكاش',
} as const;
