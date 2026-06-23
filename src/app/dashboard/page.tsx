'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Header from '@/components/layout/Header'
import { DescricaoServico, StatusDS } from '@/types'
import { STATUS_CONFIG, formatDate } from '@/lib/utils'

export default function DashboardPage() {
  const [dsList, setDsList] = useState<DescricaoServico[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')
  const [filtroObra, setFiltroObra] = useState<string>('todas')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadDS()
  }, [])

  const loadDS = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    const { data, error } = await supabase
      .from('descricoes_servico')
      .select('*, obra:obras(*)')
      .order('criado_em', { ascending: false })

    if (!error && data) setDsList(data)
    setLoading(false)
  }

  const obras = Array.from(new Map(dsList.map(ds => [ds.obra_id, ds.obra])).values())

  const dsFiltradas = dsList.filter(ds => {
    const matchStatus = filtroStatus === 'todos' || ds.status === filtroStatus
    const matchObra = filtroObra === 'todas' || ds.obra_id === filtroObra
    return matchStatus && matchObra
  })

  const pendentes = dsList.filter(d => d.status !== 'Aprovada').length
  const revisao = dsList.filter(d => d.status === 'Em revisão').length
  const aprovadas = dsList.filter(d => d.status === 'Aprovada').length

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FB]">
        <Header />
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-400 text-sm">Carregando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8F9FB]">
      <Header />
      <div className="max-w-5xl mx-auto px-5 py-7">

        {/* Cards resumo */}
        <div className="grid grid-cols-3 gap-4 mb-7">
          {[
            { label: 'Em andamento', valor: pendentes, color: '#E87722' },
            { label: 'Aguardando revisão', valor: revisao, color: '#dc2626' },
            { label: 'Aprovadas', valor: aprovadas, color: '#8BAB3E' },
          ].map((c, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="text-3xl font-bold" style={{ color: c.color }}>{c.valor}</div>
              <div className="text-sm text-gray-500 mt-1">{c.label}</div>
            </div>
          ))}
        </div>

        {/* Filtros + botão nova DS */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex gap-2">
            <select
              value={filtroObra}
              onChange={e => setFiltroObra(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white"
            >
              <option value="todas">Todas as obras</option>
              {obras.map(o => o && (
                <option key={o.id} value={o.id}>{o.nome}</option>
              ))}
            </select>
            <select
              value={filtroStatus}
              onChange={e => setFiltroStatus(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white"
            >
              <option value="todos">Todos os status</option>
              {Object.keys(STATUS_CONFIG).map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <Link
              href="/ds/massa"
              className="border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              ↑ Upload em massa
            </Link>
            <Link
              href="/ds/nova"
              className="bg-[#8BAB3E] hover:bg-[#7a9a35] text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              + Nova DS
            </Link>
          </div>
        </div>

        {/* Lista de DSs */}
        <div className="flex flex-col gap-3">
          {dsFiltradas.length === 0 && (
            <div className="text-center py-16 text-gray-400 text-sm">
              Nenhuma DS encontrada.
            </div>
          )}
          {dsFiltradas.map(ds => {
            const sc = STATUS_CONFIG[ds.status as StatusDS]
            return (
              <Link
                key={ds.id}
                href={`/ds/${ds.id}`}
                className="bg-white rounded-xl border border-gray-100 px-6 py-4 flex items-center justify-between hover:shadow-sm transition-shadow cursor-pointer"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-[#111]">{ds.obra?.nome}</span>
                    <span className="text-gray-300">·</span>
                    <span className="text-sm text-gray-500">{ds.mes_referencia}</span>
                  </div>
                  <div className="text-xs text-gray-400">{ds.obra?.cliente} · {ds.obra?.responsavel_nome}</div>
                </div>
                <div className="flex items-center gap-5">
                  <span className="font-semibold text-[#111]">{ds.valor_total}</span>
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${sc.bgColor} ${sc.textColor}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${sc.dotColor}`} />
                    {sc.label}
                  </div>
                  <span className="text-gray-300 text-lg">›</span>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
