/**
 * Runtime-safe base path for the Poridhi reverse proxy.
 * Set NEXT_PUBLIC_BASE_PATH=/proxy/8080 in Docker builds;
 * leave empty for local development.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/**
 * Prefix a path with the deploy base path.
 * Anchors (#foo) and external URLs are passed through unchanged.
 */
export function prefixHref(path: string): string {
  if (!BASE_PATH) return path;
  if (path.startsWith('#') || path.startsWith('http')) return path;
  if (path.startsWith('/')) return `${BASE_PATH}${path}`;
  return path;
}
