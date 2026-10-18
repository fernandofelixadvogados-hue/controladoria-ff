'use client'

import { useState, useCallback } from 'react'
import {
  Users, MessageSquare, ChevronDown, ChevronRight,
  Loader2, AlertCircle, Sparkles, UserCheck, UserX, Search,
} from 'lucide-react'
import clsx from 'clsx'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClassifiedTicket {
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

interface AvaliacaoData {
  collaborator: string
  date: string
  clientes: ClassifiedTicket[]
  leads: ClassifiedTicket[]
  errors?: string[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COLABORADORES = [
  { name: 'Ana Carolina',  initials: 'AC' },
  { name: 'Pedro Lucas',   initials: 'PL' },
  { name: 'Yasmim Rocha',  initials: 'YR' },
  { name: 'Karla Freitas', initials: 'KF' },
  { name: 'Fernando Felix',initials: 'FF' },
]

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo',
  })
}

// ─── TicketCard ───────────────────────────────────────────────────────────────

function TicketCard({
  ticket,
  collaboratorName,
  isCliente,
}: {
  ticket: ClassifiedTicket
  collaboratorName: string
  isCliente: boolean
}) {
  const [open, setOpen] = useState(false)
  const [evaluating, setEvaluating] = useState(false)
  const [evaluation, setEvaluation] = useState<string | null>(null)
  const [evalError, setEvalError] = useState<string | null>(null)

  const evaluate = useCallback(async () => {
    setEvaluating(true)
    setEvalError(null)
    try {
      const res = await fetch('/api/avaliar-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId: ticket.ticketId,
          contactName: ticket.contactName,
          collaboratorName,
        }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setEvaluation(json.evaluation)
      setOpen(true)
    } catch (e) {
      setEvalError(e instanceof Error ? e.message : String(e))
    } finally {
      setEvaluating(false)
    }
  }, [ticket, collaboratorName])

  return (
    <div className="rounded-lg border border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-900/60">
        {isCliente ? (
          <UserCheck size={14} className="text-emerald-400 shrink-0" />
        ) : (
          <UserX size={14} className="text-amber-400 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-200 truncate">{ticket.contactName}</p>
          <p className="text-xs text-gray-500">
            {fmtTime(ticket.startedAt)}
            {ticket.protocol && ` · #${ticket.protocol}`}
            {ticket.step && ` · ${ticket.step}`}
          </p>
        </div>

        {isCliente && (
          <button
            onClick={evaluation ? () => setOpen((o) => !o) : evaluate}
            disabled={evaluating}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors shrink-0',
              evaluation
                ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                : 'bg-brand-500/20 text-brand-400 hover:bg-brand-500/30 border border-brand-500/30'
            )}
          >
            {evaluating ? (
              <><Loader2 size={11} className="animate-spin" /> Avaliando…</>
            ) : evaluation ? (
              <>{open ? <ChevronDown size={11} /> : <ChevronRight size={11} />} Ver avaliação</>
            ) : (
              <><Sparkles size={11} /> Avaliar</>
            )}
          </button>
        )}
      </div>

      {/* Evaluation */}
      {evalError && (
        <div className="px-4 py-2 bg-red-950/30 text-xs text-red-400 flex gap-1.5 items-start">
          <AlertCircle size={11} className="mt-0.5 shrink-0" />
          {evalError}
        </div>
      )}
      {evaluation && open && (
        <div className="px-4 py-3 bg-gray-950/60 border-t border-gray-800">
          <div className="prose prose-invert prose-sm max-w-none text-xs leading-relaxed text-gray-300">
            {evaluation.split('\n').map((line, i) => {
              if (line.startsWith('## ') || line.startsWith('**')) {
                return (
                  <p key={i} className="font-semibold text-gray-200 mt-2 mb-1">
                    {line.replace(/^#+\s*/, '').replace(/\*\*/g, '')}
                  </p>
                )
              }
              if (line.startsWith('- ') || line.startsWith('• ')) {
                return (
                  <p key={i} className="pl-3 text-gray-400">
                    {line}
                  </p>
                )
              }
              return line.trim() ? (
                <p key={i} className="text-gray-300">{line}</p>
              ) : (
                <div key={i} className="h-1" />
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AvaliacaoAtendimento() {
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(today)
  const [selected, setSelected] = useState(COLABORADORES[0].name)
  const [data, setData] = useState<AvaliacaoData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [evaluatingAll, setEvaluatingAll] = useState(false)
  const [allEvals, setAllEvals] = useState<Record<string, string>>({})

  const buscar = useCallback(async () => {
    setLoading(true)
    setError(null)
    setData(null)
    setAllEvals({})
    try {
      const res = await fetch(
        `/api/avaliar-atendimento?date=${date}&collaborator=${encodeURIComponent(selected)}`
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? `HTTP ${res.status}`)
      }
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [date, selected])

  const avaliarTodos = useCallback(async () => {
    if (!data?.clientes.length) return
    setEvaluatingAll(true)
    const results: Record<string, string> = {}
    for (const t of data.clientes) {
      try {
        const res = await fetch('/api/avaliar-ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ticketId: t.ticketId,
            contactName: t.contactName,
            collaboratorName: selected,
          }),
        })
        const json = await res.json()
        results[t.ticketId] = json.evaluation ?? json.error ?? 'Sem resposta'
      } catch (e) {
        results[t.ticketId] = `Erro: ${e instanceof Error ? e.message : String(e)}`
      }
    }
    setAllEvals(results)
    setEvaluatingAll(false)
  }, [data, selected])

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 whitespace-nowrap">Data</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-md px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-brand-400"
          />
        </div>

        <div className="flex items-center gap-1 bg-gray-800/60 rounded-lg p-1">
          <Users size={13} className="text-gray-500 ml-2" />
          {COLABORADORES.map((col) => (
            <button
              key={col.name}
              onClick={() => setSelected(col.name)}
              title={col.name}
              className={clsx(
                'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                selected === col.name
                  ? 'bg-brand-500 text-white'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/60'
              )}
            >
              {col.initials}
              <span className="hidden sm:inline ml-1.5">{col.name.split(' ')[0]}</span>
            </button>
          ))}
        </div>

        <button
          onClick={buscar}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          Buscar atendimentos
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-red-400 bg-red-950/30 border border-red-800/40 rounded-lg px-4 py-3 text-sm">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {/* Partial errors */}
      {data?.errors && data.errors.length > 0 && (
        <div className="flex flex-col gap-1 bg-yellow-950/20 border border-yellow-700/30 rounded-lg px-4 py-3">
          {data.errors.map((e, i) => (
            <p key={i} className="text-xs text-yellow-400 flex items-center gap-1.5">
              <AlertCircle size={11} /> {e}
            </p>
          ))}
        </div>
      )}

      {/* Results */}
      {data && !loading && (
        <div className="space-y-6">
          {/* Summary bar */}
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-400">
              <span className="font-semibold text-gray-200">{data.clientes.length}</span> cliente{data.clientes.length !== 1 ? 's' : ''}
            </span>
            <span className="text-gray-600">·</span>
            <span className="text-gray-400">
              <span className="font-semibold text-gray-200">{data.leads.length}</span> lead{data.leads.length !== 1 ? 's' : ''}
            </span>
            {data.clientes.length > 1 && (
              <>
                <span className="text-gray-600">·</span>
                <button
                  onClick={avaliarTodos}
                  disabled={evaluatingAll}
                  className="flex items-center gap-1.5 text-brand-400 hover:text-brand-300 font-medium transition-colors disabled:opacity-50"
                >
                  {evaluatingAll
                    ? <><Loader2 size={13} className="animate-spin" /> Avaliando todos…</>
                    : <><Sparkles size={13} /> Avaliar todos os clientes</>
                  }
                </button>
              </>
            )}
          </div>

          {data.clientes.length === 0 && data.leads.length === 0 && (
            <div className="text-center py-12 text-gray-500 text-sm">
              Nenhum atendimento encontrado para {selected} em {date}
            </div>
          )}

          {/* Clientes */}
          {data.clientes.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                <UserCheck size={12} className="text-emerald-400" />
                Clientes ({data.clientes.length})
              </h3>
              <div className="space-y-2">
                {data.clientes.map((t) => (
                  <TicketCard
                    key={t.ticketId}
                    ticket={allEvals[t.ticketId]
                      ? { ...t }
                      : t
                    }
                    collaboratorName={selected}
                    isCliente
                  />
                ))}
              </div>
              {/* Bulk evaluations */}
              {Object.keys(allEvals).length > 0 && (
                <div className="mt-4 space-y-3">
                  {data.clientes.map((t) =>
                    allEvals[t.ticketId] ? (
                      <div key={t.ticketId} className="rounded-lg border border-brand-700/30 bg-gray-950/60 overflow-hidden">
                        <div className="px-4 py-2 bg-gray-900/60 flex items-center gap-2">
                          <Sparkles size={12} className="text-brand-400" />
                          <span className="text-xs font-medium text-gray-300">
                            Avaliação — {t.contactName}
                          </span>
                        </div>
                        <div className="px-4 py-3 text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">
                          {allEvals[t.ticketId]}
                        </div>
                      </div>
                    ) : null
                  )}
                </div>
              )}
            </div>
          )}

          {/* Leads */}
          {data.leads.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                <UserX size={12} className="text-amber-400" />
                Leads ({data.leads.length}) — listados sem avaliação detalhada
              </h3>
              <div className="space-y-2">
                {data.leads.map((t) => (
                  <TicketCard
                    key={t.ticketId}
                    ticket={t}
                    collaboratorName={selected}
                    isCliente={false}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
