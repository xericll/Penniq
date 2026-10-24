/** Keeps a left-to-right run (an amount such as "2,400 €") in one piece inside right-to-left text. */
export function isolate(text: string): string {
  return `⁦${text}⁩`;
}
