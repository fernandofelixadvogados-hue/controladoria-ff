import { NextResponse } from 'next/server'
import { getAllTrackings } from '@/lib/judit'
import { getAllLawsuits, getSettings } from '@/lib/advbox'

export const dynamic = 'force-dynamic'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function GET() {
  try {
    // Busca sequencial para não estourar rate-limit do AdvBox
    const settings = await getSettings()
    await sleep(400)
    const lawsuits = await getAllLawsuits()

    const trackings = await getAllTrackings()

    const stageMap = Object.fromEntries(
      settings.stages.map((s) => [s.id, s.stage])
    )

    // Map CNJ → lawsuit
    const lawsuitByCnj = Object.fromEntries(
      lawsuits
        .filter((l) => l.process_number)
        .map((l) => [l.process_number!, l])
    )

    // Apenas trackings ativos por CNJ
    const active = trackings.filter(
      (t) => t.status === 'updated' && t.search.search_type === 'lawsuit_cnj'
    )

    const results = active.map((t) => {
      const lawsuit = lawsuitByCnj[t.search.search_key]
      const customers = lawsuit?.customers ?? []
      return {
        tracking_id: t.tracking_id,
        request_id: t.request_id,
        cnj: t.search.search_key,
        lawsuit_id: lawsuit?.id ?? null,
        cliente: customers.map((c) => c.name).join(', ') || '—',
        contact_name: customers[0]?.name ?? null,
        etapa: lawsuit ? stageMap[lawsuit.stages_id] ?? '—' : '—',
        last_updated: t.updated_at,
      }
    })

    // Ordenar pelos mais recentemente atualizados
    results.sort((a, b) => b.last_updated.localeCompare(a.last_updated))

    return NextResponse.json(results)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
