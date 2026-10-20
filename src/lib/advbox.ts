const BASE = process.env.ADVBOX_API_URL ?? ''
const TOKEN = process.env.ADVBOX_TOKEN ?? ''

const headers = () => ({
  'Authorization': `Bearer ${TOKEN}`,
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  // AdvBox está atrás do Cloudflare — bloqueia sem User-Agent de navegador
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
})

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AdvboxLawsuit {
  id: number
  folder: string
  process_number: string | null
  customers: Array<{ name: string }>
  stages_id: number
  users: Array<{ user_id: number; name: string }>
}

export interface AdvboxTask {
  id: number
  date: string
  date_deadline: string | null
  task: string
  notes: string | null
  lawsuits_id: number | null
  from?: number | string | null
  lawsuit?: {
    id: number
    process_number: string | null
    customers: Array<{ customer_id: number; name: string }>
  }
  users: Array<{
    user_id: number
    name: string
    completed: string | null
    important: number
    urgent: number
  }>
}

export interface AdvboxSettings {
  stages: Array<{ id: number; stage: string; step: string }>
  users: Array<{ id: number; name: string }>
}

interface ListResponse<T> {
  totalCount: number
  offset: number
  data: T[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function request<T>(
  endpoint: string,
  params: Record<string, string | number | boolean> = {},
  retries = 3,
): Promise<T> {
  if (!BASE || !TOKEN) {
    throw new Error('ADVBOX_API_URL ou ADVBOX_TOKEN não configurados nas variáveis de ambiente.')
  }
  const url = new URL(`${BASE}/${endpoint}`)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)))
  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch(url.toString(), { headers: headers(), cache: 'no-store' })
    if (res.status === 429) {
      if (attempt < retries - 1) {
        await sleep(800 * (attempt + 1)) // 800ms, 1600ms, 2400ms
        continue
      }
    }
    if (!res.ok) throw new Error(`AdvBox /${endpoint} → HTTP ${res.status}`)
    const text = await res.text()
    if (!text) return {} as T
    return JSON.parse(text) as T
  }
  throw new Error(`AdvBox /${endpoint} → HTTP 429 após ${retries} tentativas`)
}

// ─── Cache ────────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

let lawsuitsCache: { data: AdvboxLawsuit[]; at: number } | null = null
const LAWSUITS_TTL = 5 * 60 * 1000 // 5 min

let settingsCache: { data: AdvboxSettings; at: number } | null = null
const SETTINGS_TTL = 30 * 60 * 1000 // 30 min — settings mudam raramente

const tasksDateCache = new Map<string, { data: AdvboxTask[]; at: number }>()
const TASKS_DATE_TTL = 5 * 60 * 1000 // 5 min

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getAllLawsuits(): Promise<AdvboxLawsuit[]> {
  if (lawsuitsCache && Date.now() - lawsuitsCache.at < LAWSUITS_TTL) {
    return lawsuitsCache.data
  }
  const all: AdvboxLawsuit[] = []
  let offset = 0
  const limit = 100
  while (true) {
    const res = await request<ListResponse<AdvboxLawsuit>>('lawsuits', { limit, offset })
    all.push(...res.data)
    if (all.length >= res.totalCount) break
    offset += limit
    await sleep(300) // evitar rate limit (429) do AdvBox/Cloudflare
  }
  lawsuitsCache = { data: all, at: Date.now() }
  return all
}

export async function listPendingTasks(params: {
  user_id?: number
  limit?: number
  offset?: number
} = {}): Promise<{ total: number; tasks: AdvboxTask[]; has_more: boolean }> {
  const res = await request<ListResponse<AdvboxTask>>('posts', {
    ...(params.user_id ? { user_id: params.user_id } : {}),
    limit: params.limit ?? 100,
    offset: params.offset ?? 0,
  })
  return {
    total: res.totalCount,
    tasks: res.data,
    has_more: res.totalCount > (params.offset ?? 0) + res.data.length,
  }
}

export async function getSettings(): Promise<AdvboxSettings> {
  if (settingsCache && Date.now() - settingsCache.at < SETTINGS_TTL) {
    return settingsCache.data
  }
  const data = await request<AdvboxSettings>('settings')
  settingsCache = { data, at: Date.now() }
  return data
}

export interface AdvboxMovement {
  id: number
  date: string
  description: string
}

export async function getLawsuitTasks(lawsuit_id: number): Promise<AdvboxTask[]> {
  const res = await request<ListResponse<AdvboxTask>>('posts', { lawsuit_id, limit: 100, offset: 0 })
  return res.data ?? []
}

export async function getLawsuitMovements(lawsuit_id: number): Promise<AdvboxMovement[]> {
  const res = await request<ListResponse<AdvboxMovement>>(`movements/${lawsuit_id}`, { limit: 50, offset: 0 })
  return res.data ?? []
}

export async function getTasksForDate(date: string): Promise<AdvboxTask[]> {
  return getTasksForDateRange(date, date)
}

export async function getTasksForDateRange(dateFrom: string, dateTo: string): Promise<AdvboxTask[]> {
  const cacheKey = `${dateFrom}__${dateTo}`
  const cached = tasksDateCache.get(cacheKey)
  if (cached && Date.now() - cached.at < TASKS_DATE_TTL) {
    return cached.data
  }
  const all: AdvboxTask[] = []
  let offset = 0
  const limit = 100
  while (true) {
    const res = await request<ListResponse<AdvboxTask>>('posts', { date_start: dateFrom, date_end: dateTo, limit, offset })
    all.push(...res.data)
    if (all.length >= res.totalCount || res.data.length === 0) break
    offset += limit
    if (offset > 0) await sleep(350)
  }
  tasksDateCache.set(cacheKey, { data: all, at: Date.now() })
  return all
}
