/**
 * Keeps an arbitrary response-document key inside one React Router path
 * segment. The first encoding survives the router's path decoding; the
 * second is removed at the route boundary before the key reaches the editor.
 */
export function draftDocumentPath(applicationId: string, documentKey: string) {
  const routeKey = encodeURIComponent(encodeURIComponent(documentKey));
  return `/applications/${encodeURIComponent(applicationId)}/draft/${routeKey}`;
}

/** Accepts both protected keys and legacy keys that need no extra decoding. */
export function decodeDraftDocumentKey(routeKey?: string) {
  if (!routeKey) return undefined;
  try {
    return decodeURIComponent(routeKey);
  } catch {
    return routeKey;
  }
}
