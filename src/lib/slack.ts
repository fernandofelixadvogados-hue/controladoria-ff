const BOT_TOKEN = process.env.SLACK_BOT_TOKEN ?? ''
const SLACK_API = 'https://slack.com/api'

// Mapa de user IDs do escritório FF → nomes
const USER_NAMES: Record<string, string> = {
  U0ATLR0S0QY: 'Fernando Felix',
  U0AT5DNA8AD: 'Karla Freitas',
  U0ASP73P6QM: 'Yasmim Rocha',
  U0ASSK29SUA: 'Pedro Lucas',
  U0ASB5M0NS3: 'Ana Carolina',
}

export interface SlackMessage {
  ts: string
  text: string
  user: string
  userName: string
  date: string // ISO string
}

async function slackGet<T>(method: string, params: Record<string, string | number> = {}): Promise<T> {
  if (!BOT_TOKEN) throw new Error('SLACK_BOT_TOKEN não configurado')
  const url = new URL(`${SLACK_API}/${method}`)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)))
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${BOT_TOKEN}`, Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Slack API /${method} → HTTP ${res.status}`)
  const data = await res.json()
  if (!data.ok) throw new Error(`Slack API /${method} → ${data.error}`)
  return data as T
}

export interface SlackChannel {
  id: string
  name: string
  updated?: number // last activity timestamp (ms)
}

export async function listCaseChannels(activeOnDate?: string): Promise<SlackChannel[]> {
  const channels: SlackChannel[] = []
  let cursor: string | undefined
  // If filtering by date, compute day-start in Unix seconds (Brazil = UTC-3)
  const dayStartSec = activeOnDate
    ? new Date(`${activeOnDate}T00:00:00-03:00`).getTime() / 1000
    : null
  do {
    const res = await slackGet<{
      channels: Array<{ id: string; name: string; updated?: number }>
      response_metadata?: { next_cursor?: string }
    }>('conversations.list', {
      types: 'private_channel',
      exclude_archived: 'true',
      limit: 200,
      ...(cursor ? { cursor } : {}),
    })
    for (const c of res.channels ?? []) {
      if (!c.name.startsWith('caso-ff-')) continue
      // updated is in ms; skip channels with no activity on or after the target day
      if (dayStartSec && c.updated && c.updated / 1000 < dayStartSec) continue
      channels.push({ id: c.id, name: c.name, updated: c.updated })
    }
    cursor = res.response_metadata?.next_cursor || undefined
  } while (cursor)
  return channels
}

export async function getChannelMessagesInRange(
  channelId: string,
  oldestSec: number,
  latestSec: number
): Promise<SlackMessage[]> {
  const res = await slackGet<{
    messages: Array<{ ts: string; text: string; user?: string; subtype?: string }>
  }>('conversations.history', {
    channel: channelId,
    oldest: String(oldestSec),
    latest: String(latestSec),
    limit: 100,
  })
  return (res.messages ?? [])
    .filter((m) => !m.subtype)
    .map((m) => ({
      ts: m.ts,
      text: m.text ?? '',
      user: m.user ?? '',
      userName: USER_NAMES[m.user ?? ''] ?? m.user ?? 'Desconhecido',
      date: new Date(parseFloat(m.ts) * 1000).toISOString(),
    }))
}

export async function findCaseChannel(lawsuit_id: number): Promise<string | null> {
  const prefix = `caso-ff-${lawsuit_id}-`
  let cursor: string | undefined
  do {
    const res = await slackGet<{
      channels: Array<{ id: string; name: string }>
      response_metadata?: { next_cursor?: string }
    }>('conversations.list', {
      types: 'private_channel',
      exclude_archived: 'true',
      limit: 200,
      ...(cursor ? { cursor } : {}),
    })
    const found = res.channels?.find((c) => c.name.startsWith(prefix))
    if (found) return found.id
    cursor = res.response_metadata?.next_cursor || undefined
  } while (cursor)
  return null
}

export async function getChannelMessages(channelId: string, limit = 50): Promise<SlackMessage[]> {
  const res = await slackGet<{ messages: Array<{ ts: string; text: string; user?: string }> }>(
    'conversations.history',
    { channel: channelId, limit }
  )
  return (res.messages ?? []).map((m) => ({
    ts: m.ts,
    text: m.text ?? '',
    user: m.user ?? '',
    userName: USER_NAMES[m.user ?? ''] ?? m.user ?? 'Desconhecido',
    date: new Date(parseFloat(m.ts) * 1000).toISOString(),
  }))
}
