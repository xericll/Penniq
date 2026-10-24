import {
  Bus,
  Coffee,
  HeartPulse,
  Home,
  MoreHorizontal,
  Package,
  Receipt,
  Repeat,
  ShoppingBag,
  ShoppingBasket,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { TranslationKey } from '../i18n/translations';

export type CategoryId =
  | 'groceries'
  | 'dining'
  | 'transport'
  | 'shopping'
  | 'rent'
  | 'bills'
  | 'subscriptions'
  | 'health'
  | 'goods'
  | 'salaries'
  | 'maintenance'
  | 'other';

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

/* Everyday spending first; the categories of the first versions (goods, salaries, maintenance) keep
   their stored labels, so every older entry still lands in the same place. */
export const CATEGORIES: Category[] = [
  {
    id: 'groceries',
    stored: 'بقالة',
    aliases: ['بقالة', 'groceries'],
    labelKey: 'cat.groceries',
    icon: ShoppingBasket,
    hue: '#7f8f4e',
  },
  { id: 'dining', stored: 'مطاعم ومقاهي', aliases: ['مطاعم ومقاهي', 'dining'], labelKey: 'cat.dining', icon: Coffee, hue: '#a8794f' },
  { id: 'transport', stored: 'مواصلات', aliases: ['مواصلات', 'transport'], labelKey: 'cat.transport', icon: Bus, hue: '#5f8a8b' },
  { id: 'shopping', stored: 'تسوق', aliases: ['تسوق', 'shopping'], labelKey: 'cat.shopping', icon: ShoppingBag, hue: '#b07a8c' },
  {
    id: 'rent',
    stored: 'إيجار',
    aliases: ['إيجار', 'إيجار ومقر', 'فواتير وسكن', 'rent'],
    labelKey: 'cat.rent',
    icon: Home,
    hue: '#6d7fa3',
  },
  { id: 'bills', stored: 'فواتير', aliases: ['فواتير', 'فواتير وخدمات', 'bills'], labelKey: 'cat.bills', icon: Receipt, hue: '#b9694c' },
  {
    id: 'subscriptions',
    stored: 'اشتراكات',
    aliases: ['اشتراكات', 'subscriptions'],
    labelKey: 'cat.subscriptions',
    icon: Repeat,
    hue: '#7d7bb0',
  },
  { id: 'health', stored: 'صحة', aliases: ['صحة', 'health'], labelKey: 'cat.health', icon: HeartPulse, hue: '#6f9a7a' },
  { id: 'goods', stored: 'بضاعة', aliases: ['بضاعة', 'goods'], labelKey: 'cat.goods', icon: Package, hue: '#c2a067' },
  { id: 'salaries', stored: 'رواتب', aliases: ['رواتب', 'salaries'], labelKey: 'cat.salaries', icon: Users, hue: '#879563' },
  {
    id: 'maintenance',
    stored: 'صيانة',
    aliases: ['صيانة', 'صيانة ومصاريف', 'صيانة وطوارئ', 'maintenance'],
    labelKey: 'cat.maintenance',
    icon: Wrench,
    hue: '#9a6b7f',
  },
  {
    id: 'other',
    stored: 'متفرقات',
    aliases: ['متفرقات', 'أخرى', 'مصاريف أخرى', 'other'],
    labelKey: 'cat.other',
    icon: MoreHorizontal,
    hue: '#9c9686',
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

export function isCategoryId(v: unknown): v is CategoryId {
  return typeof v === 'string' && BY_ID.has(v as CategoryId);
}
