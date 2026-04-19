import { redirect } from 'next/navigation'

type SearchParams = Record<string, string | string[] | undefined>

function researchBarnPathFrom(searchParams: SearchParams): string {
  const q = new URLSearchParams()
  for (const [key, val] of Object.entries(searchParams)) {
    if (val === undefined) continue
    if (Array.isArray(val)) val.forEach(v => q.append(key, v))
    else q.set(key, val)
  }
  const s = q.toString()
  return s ? `/research-barn?${s}` : '/research-barn'
}

/** Legacy URL: `/war-room` → `/research-barn` (query string preserved). */
export default function WarRoomLegacyRedirect({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  redirect(researchBarnPathFrom(searchParams))
}
