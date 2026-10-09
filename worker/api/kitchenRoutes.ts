// Per-kitchen web app files (plan 004 stage 6, spec 6.4 and 6.5), public and cacheable:
//   GET /k/<slug>/manifest.webmanifest?start=/o/<token>   the manifest, one per kitchen
//   GET /k/<slug>/icon-<180|192|512>.png                  the seller's small icon (any size: the
//                                                         browser scales the 512)
//   GET /k/<slug>/icon-<180|192|512>.svg                  the default icon: initials on the theme colour
// The default is an SVG because making a PNG with letters needs a font renderer (no new dependency).
// iOS wants a PNG for `apple-touch-icon`: a kitchen without an uploaded icon has none yet, so its
// `.png` icons answer 404 and the page should only link `apple-touch-icon` when the manifest's icons
// are not SVG.
import { buildManifest, defaultIconSvg, ICON_SIZES } from '../../shared/kitchenManifest';
import type { ThemeName } from '../../shared/themes';
import { DEFAULT_THEME } from '../../shared/themes';
import { keyOfRef, contentTypeOfKey, type ImageBucket } from '../images/r2';
import type { Repository } from '../repo/Repository';

const NOT_FOUND = () => new Response('Not found', { status: 404 });
const SAMPLE_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};
const DATA_URL = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/;

/** The content type of a stored small-icon ref, or undefined when there is none (or it is unusable). */
export function iconTypeOfRef(ref: string | undefined): string | undefined {
  if (ref === undefined || ref === '') return undefined;
  const data = DATA_URL.exec(ref);
  if (data) return data[1];
  if (ref.startsWith('/samples/') && !ref.includes('..')) {
    return SAMPLE_TYPES[ref.slice(ref.lastIndexOf('.') + 1).toLowerCase()];
  }
  const key = keyOfRef(ref);
  return key ? contentTypeOfKey(key) : undefined;
}

function decodeBase64(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function serveUploadedIcon(
  ref: string,
  type: string,
  images: ImageBucket | undefined,
): Promise<Response> {
  const cache = { 'Cache-Control': 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff' };
  const data = DATA_URL.exec(ref);
  if (data?.[2] !== undefined) {
    return new Response(decodeBase64(data[2]), { headers: { ...cache, 'Content-Type': type } });
  }
  if (ref.startsWith('/samples/')) {
    // A static file served by the app itself.
    return new Response(null, { status: 302, headers: { ...cache, Location: ref } });
  }
  const key = keyOfRef(ref);
  const object = key && images ? await images.get(key) : null;
  if (!object) return NOT_FOUND();
  return new Response(object.body, {
    headers: { ...cache, 'Content-Type': object.httpMetadata?.contentType ?? type },
  });
}

/** Null when the path is not one of the kitchen files, so the caller can fall through. */
export async function handleKitchenRequest(
  store: Repository,
  request: Request,
  context: { images?: ImageBucket | undefined } = {},
): Promise<Response | null> {
  const url = new URL(request.url);
  const match = /^\/k\/([^/]+)\/(manifest\.webmanifest|icon-(\d+)\.(png|svg))$/.exec(url.pathname);
  if (!match) return null;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }
  const [, rawSlug, file, rawSize, ext] = match;
  let slug: string;
  try {
    slug = decodeURIComponent(rawSlug ?? '');
  } catch {
    return NOT_FOUND();
  }
  const size = Number(rawSize);
  if (rawSize !== undefined && !(ICON_SIZES as ReadonlyArray<number>).includes(size)) {
    return NOT_FOUND();
  }
  const seller = await store.sellerBySlug(slug);
  if (!seller) return NOT_FOUND();
  const menu = await seller.getMenu();
  const theme: ThemeName = menu.theme ?? DEFAULT_THEME;
  const ref = menu.kitchen.images?.railIcon;
  const uploadedType = iconTypeOfRef(ref);

  if (file === 'manifest.webmanifest') {
    const manifest = buildManifest({
      slug,
      name: menu.kitchen.name,
      theme,
      start: url.searchParams.get('start'),
      ...(uploadedType !== undefined ? { uploadedType } : {}),
    });
    return Response.json(manifest, {
      headers: {
        'Content-Type': 'application/manifest+json',
        'Cache-Control': 'public, max-age=300',
      },
    });
  }

  if (ext === 'png') {
    if (ref === undefined || uploadedType === undefined) return NOT_FOUND();
    return serveUploadedIcon(ref, uploadedType, context.images);
  }
  // `.svg`: always the default, so a page can always show something.
  return new Response(defaultIconSvg(menu.kitchen.name, theme), {
    headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=3600' },
  });
}
