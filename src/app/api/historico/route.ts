import { NextRequest, NextResponse } from 'next/server'
import { getResponses } from '@/lib/judit'
import { getLawsuitTasks, getLawsuitMovements } from '@/lib/advbox'
import { searchContacts, getContactMessages } from '@/lib/digisac'
import { findCaseChannel, getChannelMessages } from '@/lib/slack'

export const dynamic = 'force-dynamic'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export interface HistoricoItem {
  id: string
  type: 'captura' | 'tarefa' | 'comunicacao'
  date: string
  content: string
  author?: string
  metadata?: {
    source?: 'digisac' | 'slack'
    completed?: boolean
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const request_id = searchParams.get('request_id')
  const lawsuit_id = searchParams.get('lawsuit_id')
  const contact_name = searchParams.get('contact_name')

  const items: HistoricoItem[] = []
  const errors: Record<string, string> = {}

  // ── 1. Capturas processuais (Judit) ──────────────────────────────────────
  // Itera todos os page_data items — a Judit pode retornar múltiplos resultados
  // (ex: processo público + versão em segredo de justiça) e a ordem varia com page_size.
  if (request_id) {
    try {
      const res = await getResponses(request_id, 1, 30)
      const seen = new Set<string>()
      for (const pd of res.page_data ?? []) {
        const steps = pd.response_data?.steps ?? []
        for (const step of steps) {
          if (seen.has(step.step_id)) continue
          seen.add(step.step_id)
          items.push({
            id: `judit-${step.step_id}`,
            type: 'captura',
            date: step.step_date,
            content: step.content,
          })
        }
      }
    } catch (e) {
      errors.judit = e instanceof Error ? e.message : String(e)
    }
  }

  // ── 2. Tarefas do escritório (AdvBox) — chamadas sequenciais ──────────────
  if (lawsuit_id) {
    const lwId = parseInt(lawsuit_id, 10)

    // 2a. Posts (tarefas ligadas ao processo)
    try {
      const tasks = await getLawsuitTasks(lwId)
      for (const t of tasks) {
        const completed = t.users?.some((u) => u.completed !== null)
        const author = t.users?.map((u) => u.name).join(', ') || undefined
        items.push({
          id: `task-${t.id}`,
          type: 'tarefa',
          date: t.date_deadline ?? t.date,
          content: `${t.task}${t.notes ? ` — ${t.notes}` : ''}`,
          author,
          metadata: { completed },
        })
      }
    } catch (e) {
      errors.advbox_tarefas = e instanceof Error ? e.message : String(e)
    }

    // Delay entre chamadas AdvBox para evitar rate limit
    await sleep(350)

    // 2b. Movements (andamentos registrados manualmente no AdvBox)
    try {
      const movements = await getLawsuitMovements(lwId)
      for (const m of movements) {
        if (!m.description) continue
        items.push({
          id: `mov-${m.id}`,
          type: 'tarefa',
          date: m.date,
          content: m.description,
        })
      }
    } catch (e) {
      // Ignora erros de resposta vazia (processo sem andamentos registrados)
      const msg = e instanceof Error ? e.message : String(e)
      if (!msg.includes('Unexpected end of JSON') && !msg.includes('HTTP 404')) {
        errors.advbox_andamentos = msg
      }
    }
  }

  // ── 3. Comunicação com o cliente (Digisac + Slack) ────────────────────────

  // 3a. Digisac
  if (contact_name) {
    try {
      const contacts = await searchContacts(contact_name)
      if (contacts.length > 0) {
        const messages = await getContactMessages(contacts[0].id)
        for (const msg of messages) {
          const who = msg.isFromMe ? (msg.isFromBot ? 'Bot' : 'Escritório') : contact_name
          items.push({
            id: `digisac-${msg.id}`,
            type: 'comunicacao',
            date: msg.createdAt,
            content: msg.text ?? `[${msg.type}]`,
            author: who,
            metadata: { source: 'digisac' },
          })
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (!msg.includes('não configurad')) errors.digisac = msg
    }
  }

  // 3b. Slack
  if (lawsuit_id) {
    try {
      const channelId = await findCaseChannel(parseInt(lawsuit_id, 10))
      if (channelId) {
        const messages = await getChannelMessages(channelId)
        for (const msg of messages) {
          if (!msg.text.trim()) continue
          items.push({
            id: `slack-${msg.ts}`,
            type: 'comunicacao',
            date: msg.date,
            content: msg.text,
            author: msg.userName,
            metadata: { source: 'slack' },
          })
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (!msg.includes('não configurad')) errors.slack = msg
    }
  }

  // Ordenar por data decrescente
  items.sort((a, b) => b.date.localeCompare(a.date))

  return NextResponse.json({ items, errors: Object.keys(errors).length ? errors : undefined })
}
