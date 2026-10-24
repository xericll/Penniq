import { Home, MoreHorizontal, Package, Receipt, Users, Wrench, type LucideIcon } from 'lucide-react';
import type { TranslationKey } from '../i18n/translations';

export type CategoryId = 'goods' | 'salaries' | 'rent' | 'bills' | 'maintenance' | 'other';

export interface Category {
  id: CategoryId;
  /** Value written to Transaction.category (Arabic, as earlier versions stored it). */
  stored: string;
  /** Every label earlier versions used for the same category. */
  aliases: string[];
  labelKey: TranslationKey;
  icon: LucideIcon;
  hue: string;
}

export const CATEGORIES: Category[] = [
  { id: 'goods', stored: 'بضاعة', aliases: ['بضاعة', 'goods'], labelKey: 'cat.goods', icon: Package, hue: '#e0a33a' },
  { id: 'salaries', stored: 'رواتب', aliases: ['رواتب', 'salaries'], labelKey: 'cat.salaries', icon: Users, hue: '#3fb5a5' },
  {
    id: 'rent',
    stored: 'إيجار',
    aliases: ['إيجار', 'إيجار ومقر', 'فواتير وسكن', 'rent'],
    labelKey: 'cat.rent',
    icon: Home,
    hue: '#9b87f5',
  },
  { id: 'bills', stored: 'فواتير', aliases: ['فواتير', 'فواتير وخدمات', 'bills'], labelKey: 'cat.bills', icon: Receipt, hue: '#f06a8a' },
  {
    id: 'maintenance',
    stored: 'صيانة',
    aliases: ['صيانة', 'صيانة ومصاريف', 'صيانة وطوارئ', 'maintenance'],
    labelKey: 'cat.maintenance',
    icon: Wrench,
    hue: '#f08a4b',
  },
  {
    id: 'other',
    stored: 'متفرقات',
    aliases: ['متفرقات', 'أخرى', 'مصاريف أخرى', 'other'],
    labelKey: 'cat.other',
    icon: MoreHorizontal,
    hue: '#8e9aa8',
  },
];

const BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

export function resolveCategory(raw?: string): Category {
  if (raw) {
    const found = CATEGORIES.find((c) => c.aliases.includes(raw.trim()));
    if (found) return found;
  }
  return BY_ID.get('other')!;
}

export function categoryById(id: CategoryId): Category {
  return BY_ID.get(id)!;
}
