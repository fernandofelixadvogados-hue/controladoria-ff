// Judit usa 3 base URLs distintas por tipo de operação
const TRACKING_URL = 'https://tracking.production.judit.io'
const REQUESTS_URL = 'https://requests.production.judit.io'
const API_KEY = process.env.JUDIT_TOKEN ?? ''

// Judit não usa Authorization: Bearer — usa header customizado "api-key"
const headers = () => ({
  'api-key': API_KEY,
  'Content-Type': 'application/json',
})

// ─── Types ────────────────────────────────────────────────────────────────────

export interface JuditTracking {
  tracking_id: string
  status: 'created' | 'updating' | 'updated' | 'paused' | 'deleted'
  search: { search_type: string; search_key: string }
  tracked_items_steps_count: number
  request_id: string
  updated_at: string
}

export interface JuditStep {
  step_id: string
  step_date: string
  content: string
  lawsuit_cnj: string
  private: boolean
}

export interface JuditResponse {
  request_status: string
  page: number
  all_pages_count: number
  all_count: number
  page_data: Array<{
    response_data: {
      steps: JuditStep[]
      last_step: JuditStep | null
      parties: Array<{ name: string; side: string; person_type: string }>
      phase: string
      situation: string
    }
  }>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function get<T>(
  base: string,
  endpoint: string,
  params: Record<string, string | number> = {}
): Promise<T> {
  if (!API_KEY) throw new Error('JUDIT_TOKEN não configurado nas variáveis de ambiente.')
  const url = new URL(`${base}/${endpoint}`)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)))
  const res = await fetch(url.toString(), { headers: headers(), cache: 'no-store' })
  if (!res.ok) throw new Error(`Judit /${endpoint} → HTTP ${res.status}`)
  return res.json()
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function listTrackings(page = 1, page_size = 100): Promise<{
  all_count: number
  all_pages_count: number
  page_count: number
  page_data: JuditTracking[]
}> {
  // Judit exige page_size >= 5
  return get(TRACKING_URL, 'tracking', { page, page_size: Math.max(page_size, 5) })
}

export async function getAllTrackings(): Promise<JuditTracking[]> {
  const all: JuditTracking[] = []
  let page = 1
  while (true) {
    const res = await listTrackings(page)
    all.push(...res.page_data)
    if (page >= res.all_pages_count) break
    page++
  }
  return all
}

export async function getLatestStep(request_id: string): Promise<JuditStep | null> {
  try {
    const res: JuditResponse = await get(REQUESTS_URL, 'responses', {
      request_id,
      page: 1,
      page_size: 1,
    })
    return res.page_data?.[0]?.response_data?.last_step ?? null
  } catch {
    return null
  }
}

export async function getResponses(
  request_id: string,
  page = 1,
  page_size = 30
): Promise<JuditResponse> {
  return get<JuditResponse>(REQUESTS_URL, 'responses', {
    request_id,
    page,
    page_size: Math.max(page_size, 5),
  })
}
