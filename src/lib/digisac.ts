const BASE = process.env.DIGISAC_API_BASE_URL ?? ''
const TOKEN = process.env.DIGISAC_API_TOKEN ?? ''

export interface DigisacContact {
  id: string
  name: string | null
  internalName: string | null
  data?: { jidId?: string; number?: string }
}

export interface DigisacMessage {
  id: string
  text: string | null
  type: string
  isFromMe: boolean
  isFromBot: boolean
  createdAt: string
  userId?: string | null
  contactId?: string | null
  contact?: { id: string; name: string | null }
}

export interface DigisacUser {
  id: string
  name: string | null
}

function digisacUrl(endpoint: string, params: Record<string, string | number> = {}): string {
  const query = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && String(v) !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join('&')
  return `${BASE}/${endpoint}${query ? '?' + query : ''}`
}

async function digisacGet<T>(endpoint: string, params: Record<string, string | number> = {}): Promise<T> {
  if (!BASE || !TOKEN) throw new Error('DIGISAC_API_BASE_URL ou DIGISAC_API_TOKEN não configurados')
  const url = digisacUrl(endpoint, params)
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Digisac /${endpoint} → HTTP ${res.status}`)
  return res.json()
}

export async function searchContacts(name: string): Promise<DigisacContact[]> {
  const res = await digisacGet<{ data: DigisacContact[] }>('contacts', {
    'where[name][$like]': `%${name}%`,
    perPage: 5,
    page: 1,
  })
  return res.data ?? []
}

export async function listUsers(): Promise<DigisacUser[]> {
  const res = await digisacGet<{ data: DigisacUser[] }>('users', { perPage: 100, page: 1 })
  return res.data ?? []
}

export async function getMessagesByAgent(userId: string, dateFrom: string, dateTo?: string): Promise<DigisacMessage[]> {
  // Brazil is UTC-3; convert local date to UTC range
  const dateStart = new Date(`${dateFrom}T00:00:00-03:00`).toISOString()
  const dateEnd = new Date(`${dateTo ?? dateFrom}T23:59:59-03:00`).toISOString()
  const all: DigisacMessage[] = []
  let page = 1
  while (true) {
    const res = await digisacGet<{ data: DigisacMessage[]; meta?: { lastPage?: number } }>('messages', {
      'where[userId][$eq]': userId,
      'where[isFromMe][$eq]': 'true',
      'where[createdAt][$gte]': dateStart,
      'where[createdAt][$lte]': dateEnd,
      'include[]': 'contact',
      perPage: 100,
      page,
    })
    all.push(...(res.data ?? []))
    const lastPage = res.meta?.lastPage ?? 1
    if (page >= lastPage) break
    page++
  }
  return all
}

export async function getContactMessages(contactId: string, page = 1): Promise<DigisacMessage[]> {
  const res = await digisacGet<{ data: DigisacMessage[] }>('messages', {
    'where[contactId]': contactId,
    'order[0][0]': 'createdAt',
    'order[0][1]': 'DESC',
    perPage: 30,
    page,
  })
  return res.data ?? []
}

// ─── Tickets ──────────────────────────────────────────────────────────────────

export interface DigisacTicket {
  id: string
  protocol: string | null
  contactId: string
  userId: string | null
  startedAt: string
  endedAt: string | null
  isOpen: boolean
}

interface TicketListResponse {
  data: DigisacTicket[]
  total: number
  lastPage: number
}

export async function getTicketsPage(page: number, perPage = 100): Promise<TicketListResponse> {
  const res = await digisacGet<TicketListResponse>('tickets', { perPage, page })
  return { data: res.data ?? [], total: res.total ?? 0, lastPage: res.lastPage ?? 1 }
}

export async function getTicketsForDate(date: string, userId: string): Promise<DigisacTicket[]> {
  const dayStart = new Date(`${date}T00:00:00-03:00`).toISOString()
  const dayEnd   = new Date(`${date}T23:59:59-03:00`).toISOString()

  // Get total then calculate lastPage based on perPage=100 (not from the perPage=1 response)
  const { total } = await getTicketsPage(1, 1)
  const perPage = 100
  const lastPage = Math.ceil(total / perPage)

  const result: DigisacTicket[] = []

  for (let p = lastPage; p >= Math.max(1, lastPage - 5); p--) {
    const { data } = await getTicketsPage(p, perPage)
    for (const t of data) {
      if (t.userId === userId && t.startedAt >= dayStart && t.startedAt <= dayEnd) {
        result.push(t)
      }
    }
    // If oldest ticket on this page predates the target day, stop searching
    if (data.length > 0 && data[0].startedAt < dayStart) break
  }

  return result
}

export async function getTicketsForDateRange(dateFrom: string, dateTo: string, userId: string): Promise<DigisacTicket[]> {
  // Generate list of dates in range (max 14 days)
  const dates: string[] = []
  const cur = new Date(`${dateFrom}T12:00:00-03:00`)
  const end = new Date(`${dateTo}T12:00:00-03:00`)
  while (cur <= end && dates.length < 14) {
    dates.push(cur.toISOString().slice(0, 10))
    cur.setDate(cur.getDate() + 1)
  }
  const all: DigisacTicket[] = []
  const seen = new Set<string>()
  for (const d of dates) {
    const tickets = await getTicketsForDate(d, userId)
    for (const t of tickets) {
      if (!seen.has(t.id)) {
        seen.add(t.id)
        all.push(t)
      }
    }
  }
  return all
}

export async function getContactById(contactId: string): Promise<DigisacContact | null> {
  try {
    const res = await digisacGet<{ data: DigisacContact[] }>('contacts', {
      'where[id][$eq]': contactId,
      perPage: 1,
    })
    return res.data?.[0] ?? null
  } catch {
    return null
  }
}

export async function getTicketMessages(ticketId: string): Promise<DigisacMessage[]> {
  const res = await digisacGet<{ data: DigisacMessage[] }>('messages', {
    'where[ticketId][$eq]': ticketId,
    'order[0][0]': 'createdAt',
    'order[0][1]': 'ASC',
    perPage: 100,
    page: 1,
  })
  return (res.data ?? []).filter((m) => m.type === 'chat' || m.text)
}
