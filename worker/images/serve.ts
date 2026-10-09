// GET /images/<key>: streams a seller image from R2. Keys carry a content hash, so the answer can
// be cached for a year and never revalidated.
import { contentTypeOfKey, IMAGE_PATH_PREFIX, isImageKey, type ImageBucket } from './r2';

export const IMAGE_CACHE_CONTROL = 'public, max-age=31536000, immutable';

/** Null when the path is not an image path, so the caller can fall through. */
export async function serveImage(bucket: ImageBucket, request: Request): Promise<Response | null> {
  const { pathname } = new URL(request.url);
  if (!pathname.startsWith(IMAGE_PATH_PREFIX)) return null;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }
  let key: string;
  try {
    key = decodeURIComponent(pathname.slice(IMAGE_PATH_PREFIX.length));
  } catch {
    return new Response('Not found', { status: 404 });
  }
  const type = contentTypeOfKey(key);
  if (!isImageKey(key) || !type) return new Response('Not found', { status: 404 });

  const object = await bucket.get(key);
  if (!object) return new Response('Not found', { status: 404 });

  const headers = new Headers({
    'Content-Type': object.httpMetadata?.contentType ?? type,
    'Cache-Control': IMAGE_CACHE_CONTROL,
    ETag: object.httpEtag,
    'X-Content-Type-Options': 'nosniff',
  });
  if (request.headers.get('If-None-Match') === object.httpEtag) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(request.method === 'HEAD' ? null : object.body, { headers });
}
