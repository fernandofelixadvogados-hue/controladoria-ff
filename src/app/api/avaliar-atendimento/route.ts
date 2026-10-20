import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getTicketsForDate, getTicketsForDateRange, getContactById } from '@/lib/digisac'
import { getAllLawsuits, getSettings } from '@/lib/advbox'

export const dynamic = 'force-dynamic'

// Hardcoded Digisac user IDs (stable — validated with skill avaliar-atendimento-digisac)
const DIGISAC_USER_IDS: Record<string, string> = {
  'Ana Carolina':  '14296f09-a09d-47a0-b185-c282e2ae1264',
  'Pedro Lucas':   '7d8e720c-01c9-4a90-a390-b38ec81a0f2d',
  'Yasmim Rocha':  'dfc3d50d-95ce-49ed-bf82-34ea1e5c30fe',
  'Karla Freitas': 'da2871cb-8690-4aa7-b9b3-2fd01b653ffe',
  'Fernando Felix':'d475a8f3-f33a-4c1c-bce2-cb97e00c21e5',
}

// Stages that belong to "NEGOCIAÇÃO" step → contact is a Lead
const NEGOTIATION_STEP = 'NEGOCIAÇÃO'

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
}

// Partial match: all significant words (>2 chars) from the query appear in the target
function partialMatch(query: string, target: string): boolean {
  const words = normalize(query).split(/\s+/).filter((w) => w.length > 2)
  const normTarget = normalize(target)
  return words.length >= 2 && words.every((w) => normTarget.includes(w))
}

export interface ClassifiedTicket {
  ticketId: string
  protocol: string | null
  contactId: string
  contactName: string
  startedAt: string
  endedAt: string | null
  classification: 'cliente' | 'lead' | 'nao_identificado'
  lawsuitId: number | null
  step: string | null
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const today = new Date().toISOString().slice(0, 10)
  const dateFrom = searchParams.get('dateFrom') ?? searchParams.get('date') ?? today
  const dateTo   = searchParams.get('dateTo')   ?? dateFrom
  const collaborator = searchParams.get('collaborator') ?? ''

  const digisacUserId = DIGISAC_USER_IDS[collaborator]
  if (!digisacUserId) {
    return NextResponse.json({ error: `Colaborador "${collaborator}" não encontrado` }, { status: 400 })
  }

  const errors: string[] = []

  // ─── 1. Fetch tickets for the period ──────────────────────────────────────
  let tickets: Awaited<ReturnType<typeof getTicketsForDate>> = []
  try {
    tickets = dateFrom === dateTo
      ? await getTicketsForDate(dateFrom, digisacUserId)
      : await getTicketsForDateRange(dateFrom, dateTo, digisacUserId)
  } catch (e) {
    errors.push(`Digisac tickets: ${e instanceof Error ? e.message : String(e)}`)
  }

  // ─── 2. Build AdvBox lookup: normalizedCustomerName → { lawsuitId, step } ─
  type LookupEntry = { lawsuitId: number; step: string }
  const lookup = new Map<string, LookupEntry>()
  const lookupEntries: Array<{ name: string; entry: LookupEntry }> = []

  try {
    const [lawsuits, settings] = await Promise.all([getAllLawsuits(), getSettings()])
    const stageToStep = new Map<number, string>(
      settings.stages.map((s) => [s.id, s.step])
    )
    for (const lw of lawsuits) {
      const step = stageToStep.get(lw.stages_id) ?? ''
      for (const c of lw.customers) {
        if (c.name) {
          lookup.set(normalize(c.name), { lawsuitId: lw.id, step })
          lookupEntries.push({ name: c.name, entry: { lawsuitId: lw.id, step } })
        }
      }
    }
  } catch (e) {
    errors.push(`AdvBox lookup: ${e instanceof Error ? e.message : String(e)}`)
  }

  // ─── 3. Classify each ticket ──────────────────────────────────────────────
  const classified: ClassifiedTicket[] = []

  for (const t of tickets) {
    const contact = await getContactById(t.contactId)
    // internalName is the full name; name may be a nickname/first name only
    const contactName = contact?.internalName ?? contact?.name ?? t.contactId

    // Try matching by internalName first, then by name, then by partial match
    const key = normalize(contactName)
    const keyAlt = contact?.name ? normalize(contact.name) : null
    const advEntry =
      lookup.get(key) ??
      (keyAlt ? lookup.get(keyAlt) : undefined) ??
      lookupEntries.find((e) => partialMatch(contactName, e.name) || (keyAlt && partialMatch(keyAlt, e.name)))?.entry

    let classification: ClassifiedTicket['classification'] = 'nao_identificado'
    let lawsuitId: number | null = null
    let step: string | null = null

    if (advEntry) {
      lawsuitId = advEntry.lawsuitId
      step = advEntry.step
      classification = advEntry.step === NEGOTIATION_STEP ? 'lead' : 'cliente'
    } else {
      // Not found in AdvBox → treat as lead (no lawsuit registered)
      classification = 'lead'
    }

    classified.push({
      ticketId: t.id,
      protocol: t.protocol,
      contactId: t.contactId,
      contactName,
      startedAt: t.startedAt,
      endedAt: t.endedAt,
      classification,
      lawsuitId,
      step,
    })
  }

  const clientes = classified.filter((t) => t.classification === 'cliente')
  const leads    = classified.filter((t) => t.classification !== 'cliente')

  return NextResponse.json({
    collaborator,
    dateFrom,
    dateTo,
    clientes,
    leads,
    errors: errors.length > 0 ? errors : undefined,
  })
}
