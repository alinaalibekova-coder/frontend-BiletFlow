// A Campaign QR (or any other link) decodes to an http(s) URL. Ticket codes never do, so such
// a value is rejected before the scan endpoint is called: it would never admit anyone.
export function looksLikeUrl(value: string): boolean {
  return /^\s*https?:\/\//i.test(value);
}
