/**
 * Penniq's public addresses. Everything is empty until the accounts exist:
 * fill in a `url` and the icon in Settings turns into a link, set SUPPORT_EMAIL
 * and the support sheet offers writing by e-mail too.
 */

export const SUPPORT_EMAIL = '';

export type SocialId = 'instagram' | 'tiktok' | 'facebook' | 'x' | 'youtube' | 'telegram' | 'whatsapp';

export interface SocialLink {
  id: SocialId;
  /** Brand name, shown as it is in every language. */
  name: string;
  /** Full https:// address of the account; empty while there is none. */
  url: string;
}

export const SOCIAL_LINKS: SocialLink[] = [
  { id: 'instagram', name: 'Instagram', url: '' },
  { id: 'tiktok', name: 'TikTok', url: '' },
  { id: 'facebook', name: 'Facebook', url: '' },
  { id: 'x', name: 'X', url: '' },
  { id: 'youtube', name: 'YouTube', url: '' },
  { id: 'telegram', name: 'Telegram', url: '' },
  { id: 'whatsapp', name: 'WhatsApp', url: '' },
];

/** The public address of the app, used by "Share app" and on shared achievement cards. */
export const APP_URL = 'https://penniq.netlify.app';

/** The store page once Penniq is on Google Play; until then "Rate app" collects stars and a comment in the app. */
export const STORE_URL = '';
