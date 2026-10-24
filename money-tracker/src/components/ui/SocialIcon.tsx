import { siFacebook, siInstagram, siTelegram, siTiktok, siWhatsapp, siX, siYoutube } from 'simple-icons';
import type { SocialId } from '../../lib/links';

const PATHS: Record<SocialId, string> = {
  instagram: siInstagram.path,
  tiktok: siTiktok.path,
  facebook: siFacebook.path,
  x: siX.path,
  youtube: siYoutube.path,
  telegram: siTelegram.path,
  whatsapp: siWhatsapp.path,
};

/** Brand glyph in the current text colour. */
export function SocialIcon({ id, className = '' }: { id: SocialId; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden focusable="false">
      <path d={PATHS[id]} />
    </svg>
  );
}
