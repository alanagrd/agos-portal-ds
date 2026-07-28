'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Header from '@/components/layout/Header'
import { DescricaoServico, StatusDS, TipoDS } from '@/types'
import { STATUS_CONFIG, TIPO_CONFIG, formatDate, getCompetenciaAtual, normalizarCompetencia, compararCompetencias } from '@/lib/utils'

export default function DashboardPage() {
  const [dsList, setDsList] = useState<DescricaoServico[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')
  const [filtroObra, setFiltroObra] = useState<string>('todas')
  const [filtroCompetencia, setFiltroCompetencia] = useState<string>(getCompetenciaAtual())
  const [userName, setUserName] = useState('AGOS')
  const [userEmail, setUserEmail] = useState('')
  const [processando, setProcessando] = useState<string | null>(null)
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set())
  const [enviandoEmMassa, setEnviandoEmMassa] = useState(false)
  const [apenasNaoAprovadas, setApenasNaoAprovadas] = useState(false)
  const [filtrosTipo, setFiltrosTipo] = useState<Set<TipoDS>>(new Set())
  const [tipoDropdownAberto, setTipoDropdownAberto] = useState(false)
  const tipoDropdownRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadDS()
    const intervalo = setInterval(loadDS, 60_000)
    return () => clearInterval(intervalo)
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (tipoDropdownRef.current && !tipoDropdownRef.current.contains(e.target as Node)) {
        setTipoDropdownAberto(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const loadDS = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }
    setUserName(user.email?.split('@')[0] || 'AGOS')
    setUserEmail(user.email || '')

    const { data, error } = await supabase
      .from('descricoes_servico')
      .select('*, obra:obras(*)')
      .order('criado_em', { ascending: false })

    if (!error && data) setDsList(data)
    setLoading(false)
  }

  const excluirDS = async (ds: DescricaoServico) => {
    if (!confirm('Tem certeza que deseja excluir esta DS?')) return
    setProcessando(ds.id)

    await supabase.from('historico_acoes').delete().eq('ds_id', ds.id)
    await supabase.from('versoes_pdf').delete().eq('ds_id', ds.id)
    await supabase.from('descricoes_servico').delete().eq('id', ds.id)

    const { data: arquivos } = await supabase.storage.from('ds-pdfs').list(ds.id)
    if (arquivos && arquivos.length > 0) {
      await supabase.storage.from('ds-pdfs').remove(arquivos.map(a => `${ds.id}/${a.name}`))
    }

    setProcessando(null)
    loadDS()
  }

  const aprovarDS = async (ds: DescricaoServico) => {
    if (!confirm('Confirma a aprovação desta DS?')) return
    setProcessando(ds.id)

    await supabase.from('descricoes_servico').update({ status: 'Aprovada' }).eq('id', ds.id)
    await supabase.from('historico_acoes').insert({
      ds_id: ds.id,
      acao: 'DS aprovada pelo escritório.',
      autor: userName,
      tipo: 'sistema',
    })

    setProcessando(null)
    loadDS()
  }

  const toggleFiltroTipo = (tipo: TipoDS) => {
    setFiltrosTipo(prev => {
      const next = new Set(prev)
      if (next.has(tipo)) next.delete(tipo)
      else next.add(tipo)
      return next
    })
    setSelecionadas(new Set())
  }

  const toggleSelecionada = (id: string) => {
    setSelecionadas(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const enviarSelecionadasParaAnaliseInterna = async () => {
    const ids = Array.from(selecionadas)
    if (!confirm(`Enviar ${ids.length} DS(s) selecionada(s) para análise interna?`)) return
    setEnviandoEmMassa(true)

    const resultados = await Promise.allSettled(
      ids.map(async id => {
        await supabase.from('descricoes_servico').update({ status: 'Em análise interna' }).eq('id', id)
        await supabase.from('historico_acoes').insert({
          ds_id: id,
          acao: 'DS enviada para análise interna.',
          autor: userName,
          autor_email: userEmail,
          tipo: 'sistema',
        })
      })
    )

    const sucessos = resultados.filter(r => r.status === 'fulfilled').length
    const falhas = resultados.filter(r => r.status === 'rejected').length
    if (falhas > 0) {
      alert(`${sucessos} DS(s) enviada(s) para análise interna. ${falhas} falhou — tente novamente.`)
    }

    setEnviandoEmMassa(false)
    setSelecionadas(new Set())
    loadDS()
  }

  const obras = Array.from(new Map(dsList.map(ds => [ds.obra_id, ds.obra])).values())

  const competenciaAtual = getCompetenciaAtual()
  const competencias = Array.from(
    new Map(
      [...dsList.map(ds => ds.mes_referencia), competenciaAtual]
        .map(c => [normalizarCompetencia(c), c] as [string, string])
    ).values()
  ).sort(compararCompetencias)

  const dsDoPeriodo = dsList.filter(ds => {
    const matchObra = filtroObra === 'todas' || ds.obra_id === filtroObra
    const matchCompetencia = filtroCompetencia === 'todas' || normalizarCompetencia(ds.mes_referencia) === normalizarCompetencia(filtroCompetencia)
    return matchObra && matchCompetencia
  })

  const dsFiltradas = dsDoPeriodo.filter(ds => {
    const matchStatus = filtroStatus === 'todos' || ds.status === filtroStatus
    const matchTipo = filtrosTipo.size === 0 || filtrosTipo.has(ds.tipo as TipoDS)
    const matchNaoAprovada = !apenasNaoAprovadas || ds.status !== 'Aprovada'
    return matchStatus && matchTipo && matchNaoAprovada
  })

  const dsGeradasVisiveis = dsFiltradas.filter(ds => ds.status === 'Gerada')
  const todasSelecionadas = dsGeradasVisiveis.length > 0 && dsGeradasVisiveis.every(ds => selecionadas.has(ds.id))

  const toggleSelecionarTodas = () => {
    if (todasSelecionadas) {
      setSelecionadas(new Set())
    } else {
      setSelecionadas(new Set(dsGeradasVisiveis.map(ds => ds.id)))
    }
  }

  const contagem = (status: StatusDS) => dsDoPeriodo.filter(d => d.status === status).length

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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-7">
          {[
            { label: 'Geradas', valor: contagem('Gerada'), color: '#6b7280', bg: 'bg-white border-gray-100', destaque: false },
            { label: 'Em análise interna', valor: contagem('Em análise interna'), color: '#b45309', bg: 'bg-white border-gray-100', destaque: false },
            { label: 'Alteração solicitada', valor: contagem('Alteração solicitada'), color: '#E87722', bg: 'bg-orange-50 border-[#E87722]', destaque: true },
            { label: 'Aguardando aprovação da obra', valor: contagem('Aguardando aprovação da obra'), color: '#1d4ed8', bg: 'bg-white border-gray-100', destaque: false },
            { label: 'Aprovadas', valor: contagem('Aprovada'), color: '#8BAB3E', bg: 'bg-white border-gray-100', destaque: false },
          ].map((c, i) => (
            <div
              key={i}
              className={`rounded-xl border p-5 ${c.bg} ${c.destaque ? 'border-2 shadow-md ring-2 ring-[#E87722]/20' : ''}`}
            >
              <div className={`font-bold ${c.destaque ? 'text-4xl' : 'text-3xl'}`} style={{ color: c.color }}>{c.valor}</div>
              <div className={`text-sm mt-1 ${c.destaque ? 'font-semibold text-[#E87722]' : 'text-gray-500'}`}>{c.label}</div>
              {c.destaque && c.valor > 0 && (
                <div className="text-xs text-[#E87722] font-medium mt-1.5">⚠ Ação necessária</div>
              )}
            </div>
          ))}
        </div>

        {/* Filtros + botão nova DS */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex gap-2 flex-wrap">
            <select
              value={filtroCompetencia}
              onChange={e => { setFiltroCompetencia(e.target.value); setSelecionadas(new Set()) }}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white"
            >
              <option value="todas">Todas as competências</option>
              {competencias.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select
              value={filtroObra}
              onChange={e => { setFiltroObra(e.target.value); setSelecionadas(new Set()) }}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white"
            >
              <option value="todas">Todas as obras</option>
              {obras.map(o => o && (
                <option key={o.id} value={o.id}>{o.nome}</option>
              ))}
            </select>
            <select
              value={filtroStatus}
              disabled={apenasNaoAprovadas}
              onChange={e => { setFiltroStatus(e.target.value); setApenasNaoAprovadas(false); setSelecionadas(new Set()) }}
              className={`border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white ${apenasNaoAprovadas ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <option value="todos">Todos os status</option>
              {Object.keys(STATUS_CONFIG).map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {/* Dropdown de tipo */}
            <div ref={tipoDropdownRef} className="relative">
              <button
                onClick={() => setTipoDropdownAberto(prev => !prev)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white flex items-center gap-1.5"
              >
                {filtrosTipo.size === 0 ? 'Todos os tipos' : `Tipo (${filtrosTipo.size})`}
                <span className="text-gray-400 text-xs">▾</span>
              </button>
              {tipoDropdownAberto && (
                <div className="absolute top-full left-0 mt-1 z-10 bg-white border border-gray-200 rounded-lg shadow-md p-2 min-w-[180px]">
                  {filtrosTipo.size > 0 && (
                    <button
                      onClick={() => { setFiltrosTipo(new Set()); setSelecionadas(new Set()) }}
                      className="w-full text-left px-2 py-1.5 text-xs text-[#E87722] hover:bg-orange-50 rounded mb-1"
                    >
                      Limpar seleção
                    </button>
                  )}
                  {Object.keys(TIPO_CONFIG).map(t => (
                    <label key={t} className="flex items-center gap-2 px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={filtrosTipo.has(t as TipoDS)}
                        onChange={() => toggleFiltroTipo(t as TipoDS)}
                        className="w-4 h-4 accent-[#8BAB3E]"
                      />
                      {TIPO_CONFIG[t as TipoDS].label}
                    </label>
                  ))}
                </div>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={apenasNaoAprovadas}
                onChange={e => { setApenasNaoAprovadas(e.target.checked); setFiltroStatus('todos'); setSelecionadas(new Set()) }}
                className="w-4 h-4 accent-[#8BAB3E]"
              />
              Mostrar apenas não aprovadas
            </label>
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

        {/* Barra de seleção em massa */}
        {dsGeradasVisiveis.length > 0 && (
          <div className="flex items-center justify-between bg-white border border-gray-100 rounded-xl px-4 py-3 mb-3 gap-3 flex-wrap">
            <label
              className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none"
              onClick={e => e.stopPropagation()}
            >
              <input
                type="checkbox"
                checked={todasSelecionadas}
                onChange={toggleSelecionarTodas}
                className="w-4 h-4 accent-[#8BAB3E]"
              />
              {todasSelecionadas
                ? 'Desmarcar todas'
                : `Selecionar todas as geradas (${dsGeradasVisiveis.length})`}
            </label>

            {selecionadas.size > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700">
                  {selecionadas.size} selecionada{selecionadas.size > 1 ? 's' : ''}
                </span>
                <button
                  onClick={enviarSelecionadasParaAnaliseInterna}
                  disabled={enviandoEmMassa}
                  className="bg-[#8BAB3E] hover:bg-[#7a9a35] disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors"
                >
                  {enviandoEmMassa ? 'Enviando...' : 'Enviar para análise interna'}
                </button>
                <button
                  onClick={() => setSelecionadas(new Set())}
                  className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Limpar seleção
                </button>
              </div>
            )}
          </div>
        )}

        {/* Lista de DSs */}
        <div className="flex flex-col gap-3">
          {dsFiltradas.length === 0 && (
            <div className="text-center py-16 text-gray-400 text-sm">
              Nenhuma DS encontrada.
            </div>
          )}
          {dsFiltradas.map(ds => {
            const sc = STATUS_CONFIG[ds.status as StatusDS]
            const tc = TIPO_CONFIG[ds.tipo as TipoDS] || TIPO_CONFIG.OUTROS
            return (
              <div
                key={ds.id}
                onClick={() => router.push(`/ds/${ds.id}`)}
                className={`rounded-xl border px-4 py-4 flex items-center gap-3 hover:shadow-sm transition-shadow cursor-pointer ${
                  ds.status === 'Alteração solicitada' ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-100'
                }`}
              >
                {/* Checkbox — só para Geradas */}
                {ds.status === 'Gerada' ? (
                  <input
                    type="checkbox"
                    checked={selecionadas.has(ds.id)}
                    onChange={e => { e.stopPropagation(); toggleSelecionada(ds.id) }}
                    onClick={e => e.stopPropagation()}
                    className="w-4 h-4 accent-[#8BAB3E] flex-shrink-0"
                  />
                ) : (
                  <div className="w-4 flex-shrink-0" />
                )}

                {/* Informações da DS */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-[#111]">{ds.obra?.nome}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${tc.bgColor} ${tc.textColor}`}>
                      {tc.label}
                    </span>
                    <span className="text-gray-300">·</span>
                    <span className="text-sm text-gray-500">{ds.mes_referencia}</span>
                  </div>
                  <div className="text-xs text-gray-400">
                    {ds.obra?.codigo_cliente && <span className="font-medium text-gray-500">[{ds.obra.codigo_cliente}]</span>} {ds.obra?.cliente} · {ds.obra?.responsavel_nome}
                  </div>
                </div>

                {/* Ações */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${sc.bgColor} ${sc.textColor}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${sc.dotColor}`} />
                    {sc.label}
                  </div>
                  {ds.status === 'Aguardando aprovação da obra' && (
                    <button
                      onClick={e => { e.stopPropagation(); aprovarDS(ds) }}
                      disabled={processando === ds.id}
                      title="Aprovar"
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-[#8BAB3E] hover:bg-green-50 transition-colors disabled:opacity-40"
                    >
                      ✓
                    </button>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); excluirDS(ds) }}
                    disabled={processando === ds.id}
                    title="Excluir"
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                  >
                    🗑
                  </button>
                  <span className="text-gray-300 text-lg">›</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
