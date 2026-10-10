// An image ref goes into CSS `url("…")` only when it is an own-app path or an image data URL, and
// has nothing that could close the quotes or the url(): anything else gives `none`.
const SAFE_REF =
  /^(\/images\/|\/samples\/)[\w./-]+$|^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;

export function cssUrl(ref: string | undefined): string {
  if (ref === undefined || !SAFE_REF.test(ref) || ref.includes('..')) return 'none';
  return `url("${ref}")`;
}
