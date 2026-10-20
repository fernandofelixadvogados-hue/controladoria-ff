import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSettings, getTasksForDateRange } from '@/lib/advbox'
import { listUsers, getMessagesByAgent } from '@/lib/digisac'
import { listCaseChannels, getChannelMessagesInRange } from '@/lib/slack'

export const dynamic = 'force-dynamic'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Slack user IDs for office collaborators
const SLACK_IDS: Record<string, string> = {
  'Fernando Felix': 'U0ATLR0S0QY',
  'Karla Freitas': 'U0AT5DNA8AD',
  'Yasmim Rocha': 'U0ASP73P6QM',
  'Pedro Lucas': 'U0ASSK29SUA',
  'Ana Carolina': 'U0ASB5M0NS3',
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const today = new Date().toISOString().slice(0, 10)
  const dateFrom = searchParams.get('dateFrom') ?? searchParams.get('date') ?? today
  const dateTo   = searchParams.get('dateTo')   ?? dateFrom
  const name = searchParams.get('name') ?? ''

  const errors: string[] = []

  // ─── AdvBox ─────────────────────────────────────────────────────────────────
  type AdvTask = {
    id: number; date: string; task: string; notes: string | null
    lawsuit?: { process_number: string | null; customers: Array<{ name: string }> } | null
    users: Array<{ user_id: number; name: string; completed: string | null }>
    from?: number | string | null
  }
  let advbox: { para: AdvTask[]; criadas_por: AdvTask[]; concluidas: AdvTask[]; advbox_user_id: number | null } = {
    para: [], criadas_por: [], concluidas: [], advbox_user_id: null,
  }

  try {
    const settings = await getSettings()
    const advUser = settings.users.find((u) =>
      u.name.toLowerCase() === name.toLowerCase() ||
      u.name.toLowerCase().startsWith(name.toLowerCase().split(' ')[0].toLowerCase())
    )
    const uid = advUser?.id ?? null
    advbox.advbox_user_id = uid

    await sleep(400)
    const allTasks = await getTasksForDateRange(dateFrom, dateTo)

    if (uid !== null) {
      advbox.para = allTasks.filter((t) =>
        t.users.some((u) => u.user_id === uid)
      ) as AdvTask[]

      advbox.criadas_por = allTasks.filter((t) =>
        String(t.from) === String(uid) &&
        !t.users.some((u) => u.user_id === uid) // exclude tasks also assigned to them
      ) as AdvTask[]

      advbox.concluidas = allTasks.filter((t) =>
        t.users.some((u) => u.user_id === uid && u.completed !== null)
      ) as AdvTask[]
    }
  } catch (e) {
    errors.push(`AdvBox: ${e instanceof Error ? e.message : String(e)}`)
  }

  // ─── Digisac ────────────────────────────────────────────────────────────────
  type DigiContact = { contactId: string; contactName: string; messageCount: number }
  let digisac: { contacts: DigiContact[]; digisac_user_id: string | null } = {
    contacts: [], digisac_user_id: null,
  }

  try {
    const users = await listUsers()
    const firstName = name.split(' ')[0].toLowerCase()
    const digUser = users.find(
      (u) =>
        u.name?.toLowerCase() === name.toLowerCase() ||
        u.name?.toLowerCase().startsWith(firstName)
    )
    const digUserId = digUser?.id ?? null
    digisac.digisac_user_id = digUserId

    if (digUserId) {
      await sleep(200)
      const messages = await getMessagesByAgent(digUserId, dateFrom, dateTo)
      const byContact = new Map<string, DigiContact>()
      for (const msg of messages) {
        const cid = msg.contactId ?? 'unknown'
        if (!byContact.has(cid)) {
          byContact.set(cid, {
            contactId: cid,
            contactName: msg.contact?.name ?? cid,
            messageCount: 0,
          })
        }
        byContact.get(cid)!.messageCount++
      }
      digisac.contacts = Array.from(byContact.values())
    }
  } catch (e) {
    errors.push(`Digisac: ${e instanceof Error ? e.message : String(e)}`)
  }

  // ─── Slack ──────────────────────────────────────────────────────────────────
  type SlackCh = { channelId: string; channelName: string; messages: Array<{ ts: string; text: string; date: string }> }
  let slack: { channels: SlackCh[] } = { channels: [] }

  try {
    const slackUserId = SLACK_IDS[name]
    if (slackUserId) {
      const dayStartSec = new Date(`${dateFrom}T00:00:00-03:00`).getTime() / 1000
      const dayEndSec = new Date(`${dateTo}T23:59:59-03:00`).getTime() / 1000

      const channels = await listCaseChannels(dateFrom)
      const results: SlackCh[] = []

      for (const ch of channels) {
        try {
          const msgs = await getChannelMessagesInRange(ch.id, dayStartSec, dayEndSec)
          const userMsgs = msgs.filter((m) => m.user === slackUserId)
          if (userMsgs.length > 0) {
            results.push({
              channelId: ch.id,
              channelName: ch.name,
              messages: userMsgs.map((m) => ({ ts: m.ts, text: m.text, date: m.date })),
            })
          }
        } catch {
          // skip channel errors silently
        }
        await sleep(80) // Slack rate limit: ~1 req/sec tier 3 = 50 req/min
      }
      slack.channels = results
    }
  } catch (e) {
    errors.push(`Slack: ${e instanceof Error ? e.message : String(e)}`)
  }

  return NextResponse.json({
    collaborator: name,
    dateFrom,
    dateTo,
    advbox,
    digisac,
    slack,
    errors: errors.length > 0 ? errors : undefined,
  })
}
