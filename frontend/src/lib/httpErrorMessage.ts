/**
 * Builds a short error string for failed API responses. When the backend URL
 * is wrong (e.g. Vercel instead of Railway), servers often return a full HTML
 * 404 page — we avoid dumping that into the UI.
 */
export function httpErrorMessage(status: number, bodyText: string): string {
  const t = bodyText.trim()
  if (t.startsWith('<!DOCTYPE') || t.startsWith('<html')) {
    return status === 404
      ? 'API 404: the request reached the wrong host (HTML page, not your FastAPI server). Set NEXT_PUBLIC_API_URL in Vercel to your Railway backend base URL (e.g. https://xxx.up.railway.app), redeploy, and try again.'
      : `HTTP ${status}: got an HTML error page instead of JSON — check NEXT_PUBLIC_API_URL points at your Railway API.`
  }
  try {
    const j = JSON.parse(t) as { detail?: unknown }
    if (typeof j.detail === 'string') return `${status} — ${j.detail}`
  } catch {
    /* not JSON */
  }
  if (t.length > 600) return `${status} — ${t.slice(0, 500)}…`
  return `${status} — ${t || '(empty body)'}`
}
