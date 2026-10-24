/**
 * Refraction layer for liquid glass. It must stay childless: Chromium's url() backdrop
 * filter also warps an element's own content, so labels live on the parent instead.
 * The parent should be `isolate` and must not have its own backdrop-filter.
 */
export function Lens() {
  return <span aria-hidden className="lens pointer-events-none absolute inset-0 -z-10 rounded-[inherit]" />;
}

/** Inline style that removes a glass class's own blur so the Lens layer can see the page. */
export const NO_BACKDROP = { backdropFilter: 'none', WebkitBackdropFilter: 'none' } as const;
