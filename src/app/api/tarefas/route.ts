import { NextResponse } from 'next/server'
import { listPendingTasks } from '@/lib/advbox'

export const dynamic = 'force-dynamic'

// Known collaborator IDs (from advbox_get_settings)
const COLLABORATORS: Record<string, number> = {
  pedro: 230151,
  yasmim: 145643,
  ana: 230152,
  karla: 145622,
  fernando: 145640,
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const colaborador = searchParams.get('colaborador') ?? 'todos'

  try {
    const user_id = COLLABORATORS[colaborador.toLowerCase()]

    const all = []
    let offset = 0
    const limit = 100

    while (true) {
      const { tasks, has_more } = await listPendingTasks({ user_id, limit, offset })
      all.push(...tasks)
      if (!has_more) break
      offset += limit
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const formatted = all.map((t) => {
      const deadline = t.date_deadline ? new Date(t.date_deadline) : null
      const diffDays = deadline
        ? Math.floor((today.getTime() - deadline.getTime()) / 86_400_000)
        : null

      return {
        id: t.id,
        task: t.task,
        date: t.date,
        deadline: t.date_deadline,
        overdue_days: diffDays !== null && diffDays > 0 ? diffDays : 0,
        status:
          deadline === null
            ? 'sem_prazo'
            : diffDays! > 0
            ? 'atrasado'
            : diffDays! === 0
            ? 'hoje'
            : 'no_prazo',
        lawsuit_id: t.lawsuits_id,
        cnj: t.lawsuit?.process_number ?? null,
        cliente: t.lawsuit?.customers?.map((c) => c.name).join(', ') ?? '—',
        responsaveis: t.users.map((u) => ({
          id: u.user_id,
          name: u.name,
          completed: u.completed,
        })),
        notes: t.notes,
      }
    })

    // Sort: atrasado first (more days first), then hoje, then no_prazo, then sem_prazo
    const order = { atrasado: 0, hoje: 1, no_prazo: 2, sem_prazo: 3 }
    formatted.sort((a, b) => {
      const oa = order[a.status as keyof typeof order]
      const ob = order[b.status as keyof typeof order]
      if (oa !== ob) return oa - ob
      return b.overdue_days - a.overdue_days
    })

    return NextResponse.json(formatted)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
