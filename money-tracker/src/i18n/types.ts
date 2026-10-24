export type Language = 'ar' | 'de' | 'en';

export interface LanguageInfo {
  code: Language;
  nativeName: string;
  dir: 'rtl' | 'ltr';
  /** Locale used for dates (Arabic uses Levantine month names with Western digits). */
  dateLocale: string;
  /** 6 = Saturday, 1 = Monday */
  weekStartsOn: number;
}

export const LANGUAGES: Record<Language, LanguageInfo> = {
  ar: { code: 'ar', nativeName: 'العربية', dir: 'rtl', dateLocale: 'ar-SY-u-nu-latn', weekStartsOn: 6 },
  de: { code: 'de', nativeName: 'Deutsch', dir: 'ltr', dateLocale: 'de-DE', weekStartsOn: 1 },
  en: { code: 'en', nativeName: 'English', dir: 'ltr', dateLocale: 'en-GB', weekStartsOn: 1 },
};
