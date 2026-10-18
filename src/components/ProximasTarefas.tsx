'use client'

import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { AlertTriangle, Clock, CheckCircle2, Minus, ExternalLink } from 'lucide-react'

type Status = 'atrasado' | 'hoje' | 'no_prazo' | 'sem_prazo'

interface Tarefa {
  id: number
  task: string
  date: string
  deadline: string | null
  overdue_days: number
  status: Status
  lawsuit_id: number | null
  cnj: string | null
  cliente: string
  responsaveis: Array<{ id: number; name: string; completed: string | null }>
  notes: string | null
}

type Colaborador = 'todos' | 'pedro' | 'yasmim' | 'ana' | 'karla' | 'fernando'

const COLABORADORES: Array<{ id: Colaborador; label: string }> = [
  { id: 'todos',    label: 'Todos' },
  { id: 'pedro',    label: 'Pedro Lucas' },
  { id: 'yasmim',   label: 'Yasmim' },
  { id: 'ana',      label: 'Ana Carolina' },
  { id: 'karla',    label: 'Karla' },
  { id: 'fernando', label: 'Fernando' },
]

const STATUS_CONFIG: Record<Status, { label: string; color: string; icon: React.ReactNode }> = {
  atrasado: { label: 'Atrasado',   color: 'text-red-400',    icon: <AlertTriangle size={13} /> },
  hoje:     { label: 'Hoje',       color: 'text-amber-400',  icon: <Clock size={13} /> },
  no_prazo: { label: 'No prazo',   color: 'text-emerald-400',icon: <CheckCircle2 size={13} /> },
  sem_prazo:{ label: 'Sem prazo',  color: 'text-gray-500',   icon: <Minus size={13} /> },
}

function shortName(fullName: string): string {
  const parts = fullName.trim().split(' ')
  return parts[0]
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export default function ProximasTarefas() {
  const [tarefas, setTarefas] = useState<Tarefa[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [colaborador, setColaborador] = useState<Colaborador>('todos')
  const [expanded, setExpanded] = useState<number | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/tarefas?colaborador=${colaborador}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error)
        setTarefas(data)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [colaborador])

  const counts = tarefas.reduce(
    (acc, t) => { acc[t.status] = (acc[t.status] ?? 0) + 1; return acc },
    {} as Record<string, number>
  )

  return (
    <div className="space-y-4">
      {/* Filters + stats */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1 bg-gray-900 border border-gray-800 rounded-lg p-1">
          {COLABORADORES.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setColaborador(id)}
              className={clsx(
                'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                colaborador === id
                  ? 'bg-brand-500 text-white'
                  : 'text-gray-400 hover:text-gray-200'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4 text-sm">
          <span className="text-red-400 font-semibold">{counts.atrasado ?? 0} atrasadas</span>
          <span className="text-amber-400">{counts.hoje ?? 0} hoje</span>
          <span className="text-emerald-400">{counts.no_prazo ?? 0} no prazo</span>
          <span className="text-gray-500">{counts.sem_prazo ?? 0} sem prazo</span>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-900 text-gray-400 text-xs uppercase tracking-wider">
                <th className="px-4 py-3 text-left w-8">#</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Tarefa</th>
                <th className="px-4 py-3 text-left">Cliente</th>
                <th className="px-4 py-3 text-left">Processo</th>
                <th className="px-4 py-3 text-left">Prazo</th>
                <th className="px-4 py-3 text-left">Responsável</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                    Carregando tarefas...
                  </td>
                </tr>
              )}
              {error && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-red-400">
                    Erro: {error}
                  </td>
                </tr>
              )}
              {!loading && !error && tarefas.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                    Nenhuma tarefa pendente.
                  </td>
                </tr>
              )}
              {!loading && !error && tarefas.map((t, i) => {
                const cfg = STATUS_CONFIG[t.status]
                const isExpanded = expanded === t.id

                return (
                  <>
                    <tr
                      key={t.id}
                      onClick={() => setExpanded(isExpanded ? null : t.id)}
                      className={clsx(
                        'cursor-pointer transition-colors',
                        t.status === 'atrasado'
                          ? 'bg-red-950/20 hover:bg-red-950/30'
                          : t.status === 'hoje'
                          ? 'bg-amber-950/20 hover:bg-amber-950/30'
                          : 'hover:bg-gray-800/40'
                      )}
                    >
                      <td className="px-4 py-3 text-gray-600 text-xs">{i + 1}</td>

                      <td className="px-4 py-3">
                        <span className={clsx('flex items-center gap-1.5 font-medium', cfg.color)}>
                          {cfg.icon}
                          {t.status === 'atrasado'
                            ? `${t.overdue_days}d`
                            : cfg.label}
                        </span>
                      </td>

                      <td className="px-4 py-3 font-medium text-gray-100 max-w-xs truncate">
                        {t.task}
                      </td>

                      <td className="px-4 py-3 text-gray-300 max-w-[180px] truncate">
                        {t.cliente}
                      </td>

                      <td className="px-4 py-3">
                        {t.cnj ? (
                          <span className="font-mono text-xs text-gray-400">{t.cnj}</span>
                        ) : (
                          <span className="text-gray-600 text-xs">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                        {fmtDate(t.deadline)}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {t.responsaveis.map((r) => (
                            <span
                              key={r.id}
                              className={clsx(
                                'px-2 py-0.5 rounded-full text-xs',
                                r.completed
                                  ? 'bg-emerald-900/40 text-emerald-400'
                                  : 'bg-gray-800 text-gray-300'
                              )}
                            >
                              {shortName(r.name)}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>

                    {isExpanded && t.notes && (
                      <tr key={`${t.id}-notes`} className="bg-gray-900/60">
                        <td colSpan={7} className="px-6 py-3">
                          <p className="text-gray-400 text-xs leading-relaxed whitespace-pre-line max-h-40 overflow-y-auto scrollbar-thin">
                            {t.notes.slice(0, 600)}{t.notes.length > 600 ? '…' : ''}
                          </p>
                          {t.lawsuit_id && (
                            <a
                              href={`https://app.advbox.com.br/processos/${t.lawsuit_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="mt-2 inline-flex items-center gap-1 text-xs text-brand-400 hover:underline"
                            >
                              <ExternalLink size={11} />
                              Abrir no AdvBox
                            </a>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
