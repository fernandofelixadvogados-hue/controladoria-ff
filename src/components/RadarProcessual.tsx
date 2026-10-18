'use client'

import { useEffect, useState, useCallback } from 'react'
import { ExternalLink, Search, ChevronDown, ChevronUp, Scale, ClipboardList, MessageCircle, Layers } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────

interface RadarItem {
  tracking_id: string
  request_id: string
  cnj: string
  lawsuit_id: number | null
  cliente: string
  contact_name: string | null
  etapa: string
  last_updated: string
}

interface HistoricoItem {
  id: string
  type: 'captura' | 'tarefa' | 'comunicacao'
  date: string
  content: string
  author?: string
  metadata?: { source?: 'digisac' | 'slack'; completed?: boolean }
}

interface HistoricoData {
  items: HistoricoItem[]
  errors?: Record<string, string>
}

type FilterType = 'todos' | 'captura' | 'tarefa' | 'comunicacao'

// ── Helpers ────────────────────────────────────────────────────────────────

function daysSince(iso: string | null): number {
  if (!iso) return 999
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

function staleBadge(days: number) {
  if (days === 0) return <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-900/40 text-emerald-400">Hoje</span>
  if (days <= 3)  return <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-900/30 text-emerald-500">{days}d</span>
  if (days <= 7)  return <span className="px-2 py-0.5 rounded-full text-xs bg-amber-900/30 text-amber-400">{days}d</span>
  if (days <= 30) return <span className="px-2 py-0.5 rounded-full text-xs bg-orange-900/30 text-orange-400">{days}d</span>
  return           <span className="px-2 py-0.5 rounded-full text-xs bg-red-900/30 text-red-400">{days}d</span>
}

const TYPE_META: Record<FilterType, { label: string; Icon: React.FC<{ size?: number; className?: string }> }> = {
  todos:       { label: 'Todos',                Icon: Layers },
  captura:     { label: 'Captura Processual',   Icon: Scale },
  tarefa:      { label: 'Tarefas do Escritório', Icon: ClipboardList },
  comunicacao: { label: 'Comunicação',          Icon: MessageCircle },
}

const SOURCE_BADGE: Record<string, string> = {
  digisac: 'bg-green-900/30 text-green-400',
  slack:   'bg-purple-900/30 text-purple-400',
}

const TYPE_BADGE: Record<FilterType, string> = {
  todos:       '',
  captura:     'bg-blue-900/30 text-blue-400',
  tarefa:      'bg-amber-900/30 text-amber-400',
  comunicacao: 'bg-teal-900/30 text-teal-400',
}

// ── Historico Panel ────────────────────────────────────────────────────────

function HistoricoPanel({
  item,
  onClose,
}: {
  item: RadarItem
  onClose: () => void
}) {
  const [data, setData] = useState<HistoricoData | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterType>('todos')

  useEffect(() => {
    const params = new URLSearchParams()
    if (item.request_id) params.set('request_id', item.request_id)
    if (item.lawsuit_id) params.set('lawsuit_id', String(item.lawsuit_id))
    if (item.contact_name) params.set('contact_name', item.contact_name)

    fetch(`/api/historico?${params}`)
      .then((r) => r.json())
      .then(setData)
      .catch((e) => setData({ items: [], errors: { geral: e.message } }))
      .finally(() => setLoading(false))
  }, [item.request_id, item.lawsuit_id, item.contact_name])

  const filtered = data?.items.filter(
    (i) => filter === 'todos' || i.type === filter
  ) ?? []

  return (
    <div className="bg-gray-950 border-t border-gray-800 px-4 py-4">
      {/* Filter buttons */}
      <div className="flex flex-wrap gap-2 mb-4">
        {(Object.keys(TYPE_META) as FilterType[]).map((t) => {
          const { label, Icon } = TYPE_META[t]
          const count = t === 'todos'
            ? (data?.items.length ?? 0)
            : (data?.items.filter((i) => i.type === t).length ?? 0)
          return (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === t
                  ? 'bg-brand-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              <Icon size={12} />
              {label}
              {data && (
                <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] ${
                  filter === t ? 'bg-white/20' : 'bg-gray-700 text-gray-500'
                }`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Timeline */}
      {loading && (
        <p className="text-gray-500 text-xs py-4 text-center">Carregando histórico…</p>
      )}

      {!loading && filtered.length === 0 && (
        <p className="text-gray-600 text-xs py-4 text-center">Nenhum registro encontrado.</p>
      )}

      {!loading && filtered.length > 0 && (
        <div className="space-y-1 max-h-96 overflow-y-auto pr-1 scrollbar-thin">
          {filtered.map((entry) => (
            <div key={entry.id} className="flex gap-3 py-2 border-b border-gray-800/50 last:border-0">
              {/* Date */}
              <div className="w-24 shrink-0 text-[11px] text-gray-500 pt-0.5">
                {fmtDateTime(entry.date)}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  {/* Type badge */}
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${TYPE_BADGE[entry.type]}`}>
                    {entry.type === 'captura' ? 'Captura' : entry.type === 'tarefa' ? 'Tarefa' : 'Comunicação'}
                  </span>

                  {/* Source badge for comunicacao */}
                  {entry.metadata?.source && (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] ${SOURCE_BADGE[entry.metadata.source] ?? ''}`}>
                      {entry.metadata.source}
                    </span>
                  )}

                  {/* Completed badge for tarefas */}
                  {entry.type === 'tarefa' && entry.metadata?.completed !== undefined && (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                      entry.metadata.completed ? 'bg-emerald-900/30 text-emerald-500' : 'bg-gray-800 text-gray-500'
                    }`}>
                      {entry.metadata.completed ? 'Concluída' : 'Pendente'}
                    </span>
                  )}

                  {/* Author */}
                  {entry.author && (
                    <span className="text-[11px] text-gray-600">{entry.author}</span>
                  )}
                </div>

                <p className="text-xs text-gray-300 leading-snug">{entry.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* API errors (non-blocking) */}
      {data?.errors && Object.keys(data.errors).length > 0 && (
        <div className="mt-3 text-[11px] text-gray-600 space-y-0.5">
          {Object.entries(data.errors).map(([src, msg]) => (
            <p key={src}><span className="text-gray-500">{src}:</span> {msg}</p>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function RadarProcessual({ refreshKey }: { refreshKey?: number }) {
  const [items, setItems] = useState<RadarItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    setExpanded(null)
    fetch('/api/radar')
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error)
        setItems(data)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load, refreshKey])

  const filtered = items.filter((item) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      item.cnj.includes(q) ||
      item.cliente.toLowerCase().includes(q) ||
      item.etapa.toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          type="text"
          placeholder="Buscar processo, cliente, etapa..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-brand-500"
        />
      </div>

      <div className="rounded-xl border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-900 text-gray-400 text-xs uppercase tracking-wider">
                <th className="px-4 py-3 text-left">Processo</th>
                <th className="px-4 py-3 text-left">Cliente</th>
                <th className="px-4 py-3 text-left">Etapa (AdvBox)</th>
                <th className="px-4 py-3 text-left">Última Captura</th>
                <th className="px-4 py-3 text-left">Há</th>
                <th className="px-4 py-3 text-left w-8"></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                    Carregando processos… (pode levar alguns segundos)
                  </td>
                </tr>
              )}
              {error && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-red-400">
                    Erro: {error}
                  </td>
                </tr>
              )}

              {!loading && !error && filtered.map((item) => {
                const days = daysSince(item.last_updated)
                const isExpanded = expanded === item.tracking_id

                return (
                  <>
                    <tr
                      key={item.tracking_id}
                      className={`border-t border-gray-800/60 cursor-pointer transition-colors ${
                        isExpanded ? 'bg-gray-800/40' : 'hover:bg-gray-800/30'
                      }`}
                      onClick={() => setExpanded(isExpanded ? null : item.tracking_id)}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-gray-300">
                        {item.cnj}
                      </td>
                      <td className="px-4 py-3 text-gray-200 max-w-[180px] truncate">
                        {item.cliente}
                      </td>
                      <td className="px-4 py-3 text-gray-400 max-w-[160px]">
                        <span className="text-xs leading-tight line-clamp-2">{item.etapa}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                        {fmtDate(item.last_updated)}
                      </td>
                      <td className="px-4 py-3">
                        {staleBadge(days)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {item.lawsuit_id && (
                            <a
                              href={`https://app.advbox.com.br/processos/${item.lawsuit_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-gray-600 hover:text-brand-400 transition-colors"
                              title="Abrir no AdvBox"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink size={13} />
                            </a>
                          )}
                          <span className="text-gray-600 ml-1">
                            {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          </span>
                        </div>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr key={`${item.tracking_id}-historico`} className="border-t border-gray-800/40">
                        <td colSpan={6} className="p-0">
                          <HistoricoPanel
                            item={item}
                            onClose={() => setExpanded(null)}
                          />
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

      {!loading && !error && (
        <p className="text-xs text-gray-600 text-right">
          {filtered.length} processo{filtered.length !== 1 ? 's' : ''} monitorados
        </p>
      )}
    </div>
  )
}
