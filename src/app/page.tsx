'use client'

import { useState } from 'react'
import RadarProcessual from '@/components/RadarProcessual'
import ProximasTarefas from '@/components/ProximasTarefas'
import RastreabilidadeExecucao from '@/components/RastreabilidadeExecucao'
import AvaliacaoAtendimento from '@/components/AvaliacaoAtendimento'
import { Scale, LayoutList, RefreshCw, Activity, Star } from 'lucide-react'
import clsx from 'clsx'

type Tab = 'radar' | 'tarefas' | 'rastreabilidade' | 'avaliacao'

export default function Home() {
  const [tab, setTab] = useState<Tab>('tarefas')
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-screen-2xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Scale size={20} className="text-brand-400" />
            <span className="font-semibold text-gray-100 tracking-tight">
              Fernando Felix Advogados
            </span>
            <span className="text-gray-500 text-sm">/ Controladoria</span>
          </div>

          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-100 transition-colors"
          >
            <RefreshCw size={14} />
            Atualizar
          </button>
        </div>

        {/* Tabs */}
        <div className="max-w-screen-2xl mx-auto px-6 flex gap-1 overflow-x-auto">
          {(
            [
              { id: 'tarefas',         label: 'Próximas Tarefas',           icon: LayoutList },
              { id: 'radar',           label: 'Radar Processual',            icon: Scale },
              { id: 'rastreabilidade', label: 'Rastreabilidade da Execução', icon: Activity },
              { id: 'avaliacao',       label: 'Avaliação de Atendimento',    icon: Star },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={clsx(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                tab === id
                  ? 'border-brand-400 text-brand-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              )}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-screen-2xl w-full mx-auto px-6 py-6">
        {tab === 'tarefas'          && <ProximasTarefas key={refreshKey} />}
        {tab === 'radar'            && <RadarProcessual  key={refreshKey} />}
        {tab === 'rastreabilidade'  && <RastreabilidadeExecucao key={refreshKey} />}
        {tab === 'avaliacao'        && <AvaliacaoAtendimento key={refreshKey} />}
      </main>
    </div>
  )
}
