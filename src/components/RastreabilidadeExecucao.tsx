'use client'

import { useState, useCallback } from 'react'
import { Users, BookOpen, MessageSquare, Slack, ChevronDown, ChevronRight, Loader2, AlertCircle, Search } from 'lucide-react'
import clsx from 'clsx'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdvTask {
  id: number
  date: string
  task: string
  notes: string | null
  lawsuit?: { process_number: string | null; customers: Array<{ name: string }> } | null
  users: Array<{ user_id: number; name: string; completed: string | null }>
}

interface AdvboxData {
  para: AdvTask[]
  criadas_por: AdvTask[]
  concluidas: AdvTask[]
  advbox_user_id: number | null
}

interface DigisacContact {
  contactId: string
  contactName: string
  messageCount: number
}

interface DigisacData {
  contacts: DigisacContact[]
  digisac_user_id: string | null
}

interface SlackMsg {
  ts: string
  text: string
  date: string
}

interface SlackChannel {
  channelId: string
  channelName: string
  messages: SlackMsg[]
}

interface SlackData {
  channels: SlackChannel[]
}

interface RastreabilidadeData {
  collaborator: string
  dateFrom: string
  dateTo: string
  advbox: AdvboxData
  digisac: DigisacData
  slack: SlackData
  errors?: string[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COLABORADORES = [
  { name: 'Ana Carolina', initials: 'AC' },
  { name: 'Pedro Lucas', initials: 'PL' },
  { name: 'Yasmim Rocha', initials: 'YR' },
  { name: 'Karla Freitas', initials: 'KF' },
  { name: 'Fernando Felix', initials: 'FF' },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function TaskRow({ task, highlight }: { task: AdvTask; highlight?: 'completed' }) {
  const completed = task.users.some((u) => u.completed !== null)
  const processo = task.lawsuit?.process_number
  const cliente = task.lawsuit?.customers?.[0]?.name

  return (
    <div className={clsx(
      'flex items-start gap-3 py-2.5 border-b border-gray-800/50 last:border-0',
      highlight === 'completed' && 'opacity-75'
    )}>
      <span className="mt-0.5 text-base leading-none">{completed ? '✅' : '⏳'}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-200 font-medium">{task.task}</p>
        {(processo || cliente) && (
          <p className="text-xs text-gray-500 mt-0.5 truncate">
            {processo && <span className="font-mono">{processo}</span>}
            {processo && cliente && ' · '}
            {cliente && <span>{cliente}</span>}
          </p>
        )}
        {task.notes && (
          <p className="text-xs text-gray-500 mt-0.5 italic line-clamp-1">{task.notes}</p>
        )}
      </div>
      <span className="text-xs text-gray-600 shrink-0">{task.date.slice(0, 10)}</span>
    </div>
  )
}

function Section({
  title,
  count,
  icon: Icon,
  color,
  children,
  defaultOpen = false,
}: {
  title: string
  count: number
  icon: React.ElementType
  color: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="rounded-lg border border-gray-800 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-gray-900/60 hover:bg-gray-800/60 transition-colors text-left"
      >
        <Icon size={15} className={color} />
        <span className="flex-1 text-sm font-medium text-gray-200">{title}</span>
        <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full', color, 'bg-white/5')}>
          {count}
        </span>
        {open ? <ChevronDown size={14} className="text-gray-500" /> : <ChevronRight size={14} className="text-gray-500" />}
      </button>
      {open && (
        <div className="px-4 py-2 bg-gray-950/40">
          {count === 0 ? (
            <p className="text-xs text-gray-600 py-2 italic">Nenhum registro</p>
          ) : (
            children
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function RastreabilidadeExecucao() {
  const today = new Date().toISOString().slice(0, 10)
  const [dateFrom, setDateFrom] = useState(today)
  const [dateTo, setDateTo] = useState(today)
  const [selected, setSelected] = useState(COLABORADORES[0].name)
  const [data, setData] = useState<RastreabilidadeData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setData(null)
    try {
      const res = await fetch(
        `/api/rastreabilidade?dateFrom=${dateFrom}&dateTo=${dateTo}&name=${encodeURIComponent(selected)}`
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo, selected])

  const adv = data?.advbox
  const digi = data?.digisac
  const sl = data?.slack

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Date range picker */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 whitespace-nowrap">De</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-md px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-brand-400"
          />
          <label className="text-xs text-gray-500 whitespace-nowrap">Até</label>
          <input
            type="date"
            value={dateTo}
            min={dateFrom}
            onChange={(e) => setDateTo(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-md px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-brand-400"
          />
        </div>

        {/* Collaborator selector */}
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
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          Buscar
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-3 text-gray-400 py-10 justify-center">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">Carregando rastreabilidade de {selected}…</span>
        </div>
      )}

      {!loading && !data && !error && (
        <div className="text-center py-12 text-gray-600 text-sm">
          Selecione o período e o colaborador, depois clique em Buscar.
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-red-400 bg-red-950/30 border border-red-800/40 rounded-lg px-4 py-3 text-sm">
          <AlertCircle size={15} />
          {error}
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

      {/* Content */}
      {data && !loading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* AdvBox column */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest flex items-center gap-2">
              <BookOpen size={12} /> AdvBox
            </h3>

            <Section
              title="Tarefas criadas para o colaborador executar"
              count={adv?.para.length ?? 0}
              icon={BookOpen}
              color="text-blue-400"
              defaultOpen
            >
              {adv?.para.map((t) => <TaskRow key={t.id} task={t} />)}
            </Section>

            <Section
              title="Tarefas criadas pelo colaborador"
              count={adv?.criadas_por.length ?? 0}
              icon={BookOpen}
              color="text-violet-400"
            >
              {adv?.criadas_por.map((t) => <TaskRow key={t.id} task={t} />)}
            </Section>

            <Section
              title="Tarefas concluídas"
              count={adv?.concluidas.length ?? 0}
              icon={BookOpen}
              color="text-green-400"
            >
              {adv?.concluidas.map((t) => <TaskRow key={t.id} task={t} highlight="completed" />)}
            </Section>
          </div>

          {/* Digisac column */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest flex items-center gap-2">
              <MessageSquare size={12} /> Digisac
            </h3>

            <Section
              title="Clientes atendidos"
              count={digi?.contacts.length ?? 0}
              icon={MessageSquare}
              color="text-emerald-400"
              defaultOpen
            >
              <div className="space-y-1 py-1">
                {digi?.contacts.map((c) => (
                  <div key={c.contactId} className="flex items-center justify-between py-2 border-b border-gray-800/50 last:border-0">
                    <span className="text-sm text-gray-200 truncate">{c.contactName}</span>
                    <span className="text-xs text-gray-500 shrink-0 ml-2">{c.messageCount} msg</span>
                  </div>
                ))}
              </div>
            </Section>
          </div>

          {/* Slack column */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest flex items-center gap-2">
              <Slack size={12} /> Slack
            </h3>

            {(sl?.channels.length ?? 0) === 0 && !loading && (
              <p className="text-xs text-gray-600 italic py-2">Nenhuma mensagem no Slack nesta data</p>
            )}

            {sl?.channels.map((ch) => (
              <Section
                key={ch.channelId}
                title={ch.channelName}
                count={ch.messages.length}
                icon={Slack}
                color="text-pink-400"
                defaultOpen
              >
                <div className="space-y-2 py-1">
                  {ch.messages.map((m) => (
                    <div key={m.ts} className="py-2 border-b border-gray-800/50 last:border-0">
                      <p className="text-xs text-gray-400 mb-1">
                        {new Date(m.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <p className="text-sm text-gray-200 whitespace-pre-wrap break-words line-clamp-4">{m.text}</p>
                    </div>
                  ))}
                </div>
              </Section>
            ))}
          </div>

        </div>
      )}
    </div>
  )
}
