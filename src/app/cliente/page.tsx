'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import HeaderCliente from '@/components/layout/HeaderCliente'
import { DescricaoServico, StatusDS, TipoDS } from '@/types'
import { STATUS_CONFIG, TIPO_CONFIG, formatDate, normalizarCompetencia, compararCompetencias } from '@/lib/utils'

const STATUS_CLIENTE: StatusDS[] = ['Alteração solicitada', 'Aguardando aprovação da obra', 'Aprovada']

export default function ClientePage() {
  const [dsList, setDsList] = useState<DescricaoServico[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroObra, setFiltroObra] = useState('todas')
  const [filtroCompetencia, setFiltroCompetencia] = useState('todas')
  const [filtrosTipo, setFiltrosTipo] = useState<Set<TipoDS>>(new Set())
  const [tipoDropdownAberto, setTipoDropdownAberto] = useState(false)
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [userNome, setUserNome] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [dsAtiva, setDsAtiva] = useState<DescricaoServico | null>(null)
  const [modalTipo, setModalTipo] = useState<'aprovacao' | 'revisao' | null>(null)
  const [comentarioModal, setComentarioModal] = useState('')
  const [processandoModal, setProcessandoModal] = useState(false)
  const [erroModal, setErroModal] = useState<string | null>(null)
  const tipoDropdownRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserNome(user.user_metadata?.nome ?? user.email ?? '')
        setUserEmail(user.email ?? '')
      }
    })
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
    const { data } = await supabase
      .from('descricoes_servico')
      .select('*, obra:obras(*)')
      .order('criado_em', { ascending: false })
    if (data) setDsList(data)
    setLoading(false)
  }

  const abrirModal = (ds: DescricaoServico, tipo: 'aprovacao' | 'revisao') => {
    setDsAtiva(ds)
    setModalTipo(tipo)
    setComentarioModal('')
    setErroModal(null)
  }

  const fecharModal = () => {
    setDsAtiva(null)
    setModalTipo(null)
    setComentarioModal('')
    setErroModal(null)
  }

  const confirmarAprovacao = async () => {
    if (!dsAtiva) return
    setProcessandoModal(true)
    setErroModal(null)

    const { error } = await supabase
      .from('descricoes_servico')
      .update({ status: 'Aprovada' })
      .eq('id', dsAtiva.id)

    if (error) {
      setErroModal('Não foi possível registrar a aprovação. Tente novamente.')
      setProcessandoModal(false)
      return
    }

    await supabase.from('historico_acoes').insert({
      ds_id: dsAtiva.id,
      acao: 'DS aprovada sem ressalvas.',
      autor: userNome || userEmail,
      autor_email: userEmail || undefined,
      tipo: 'cliente',
    })

    setProcessandoModal(false)
    fecharModal()
    loadDS()
  }

  const confirmarRevisao = async () => {
    if (!dsAtiva || !comentarioModal.trim()) return
    setProcessandoModal(true)
    setErroModal(null)

    const { error } = await supabase
      .from('descricoes_servico')
      .update({ status: 'Alteração solicitada' })
      .eq('id', dsAtiva.id)

    if (error) {
      setErroModal('Não foi possível registrar a solicitação. Tente novamente.')
      setProcessandoModal(false)
      return
    }

    await supabase.from('historico_acoes').insert({
      ds_id: dsAtiva.id,
      acao: `Alteração solicitada pela obra: "${comentarioModal.trim()}"`,
      autor: userNome || userEmail,
      autor_email: userEmail || undefined,
      tipo: 'cliente',
    })

    setProcessandoModal(false)
    fecharModal()
    loadDS()
  }

  const toggleFiltroTipo = (tipo: TipoDS) => {
    setFiltrosTipo(prev => {
      const next = new Set(prev)
      if (next.has(tipo)) next.delete(tipo)
      else next.add(tipo)
      return next
    })
  }

  const obras = Array.from(new Map(dsList.map(ds => [ds.obra_id, ds.obra])).values())
  const competencias = Array.from(new Set(dsList.map(ds => ds.mes_referencia))).sort(compararCompetencias)

  const dsFiltradas = dsList.filter(ds => {
    if (filtroObra !== 'todas' && ds.obra_id !== filtroObra) return false
    if (filtroCompetencia !== 'todas' && normalizarCompetencia(ds.mes_referencia) !== normalizarCompetencia(filtroCompetencia)) return false
    if (filtrosTipo.size > 0 && !filtrosTipo.has(ds.tipo as TipoDS)) return false
    if (filtroStatus !== 'todos' && ds.status !== filtroStatus) return false
    if (busca) {
      const q = busca.toLowerCase()
      const campos = [ds.obra?.nome, ds.obra?.cliente, ds.mes_referencia].join(' ').toLowerCase()
      if (!campos.includes(q)) return false
    }
    return true
  })

  const total = dsList.length
  const aprovadas = dsList.filter(d => d.status === 'Aprovada').length
  const aguardando = dsList.filter(d => d.status === 'Aguardando aprovação da obra').length

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FB]">
        <HeaderCliente />
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-400 text-sm">Carregando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8F9FB]">
      <HeaderCliente />
      <div className="max-w-4xl mx-auto px-5 py-7">

        {/* Cards resumo */}
        <div className="grid grid-cols-3 gap-4 mb-7">
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="text-3xl font-bold text-gray-700">{total}</div>
            <div className="text-sm text-gray-500 mt-1">Total de DSs</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="text-3xl font-bold text-[#8BAB3E]">{aprovadas}</div>
            <div className="text-sm text-gray-500 mt-1">Aprovadas</div>
          </div>
          <div className={`rounded-xl border p-5 ${aguardando > 0 ? 'bg-orange-50 border-[#E87722] border-2 shadow-md' : 'bg-white border-gray-100'}`}>
            <div className={`text-3xl font-bold ${aguardando > 0 ? 'text-[#E87722]' : 'text-gray-700'}`}>{aguardando}</div>
            <div className={`text-sm mt-1 ${aguardando > 0 ? 'text-[#E87722] font-semibold' : 'text-gray-500'}`}>Aguardando sua aprovação</div>
            {aguardando > 0 && <div className="text-xs text-[#E87722] font-medium mt-1.5">⚠ Ação necessária</div>}
          </div>
        </div>

        {/* Filtros */}
        <div className="flex gap-2 flex-wrap mb-4">
          <input
            type="text"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar obra, cliente..."
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white min-w-[180px]"
          />
          <select
            value={filtroCompetencia}
            onChange={e => setFiltroCompetencia(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white"
          >
            <option value="todas">Todas as competências</option>
            {competencias.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={filtroObra}
            onChange={e => setFiltroObra(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white"
          >
            <option value="todas">Todas as obras</option>
            {obras.map(o => o && <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
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
                    onClick={() => setFiltrosTipo(new Set())}
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
          <select
            value={filtroStatus}
            onChange={e => setFiltroStatus(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white"
          >
            <option value="todos">Todos os status</option>
            {STATUS_CLIENTE.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Lista */}
        <div className="flex flex-col gap-3">
          {dsFiltradas.length === 0 && (
            <div className="text-center py-16 text-gray-400 text-sm">
              Nenhuma DS encontrada para as suas obras.
            </div>
          )}
          {dsFiltradas.map(ds => {
            const sc = STATUS_CONFIG[ds.status as StatusDS]
            const tc = TIPO_CONFIG[ds.tipo as TipoDS] || TIPO_CONFIG.OUTROS
            return (
              <div
                key={ds.id}
                onClick={() => router.push(`/cliente/ds/${ds.id}`)}
                className={`rounded-xl border px-4 py-4 flex items-center gap-3 hover:shadow-sm transition-shadow cursor-pointer ${
                  ds.status === 'Aguardando aprovação da obra'
                    ? 'bg-blue-50 border-blue-100'
                    : 'bg-white border-gray-100'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-semibold text-[#111]">{ds.obra?.nome}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${tc.bgColor} ${tc.textColor}`}>
                      {tc.label}
                    </span>
                    <span className="text-gray-300">·</span>
                    <span className="text-sm text-gray-500">{ds.mes_referencia}</span>
                  </div>
                  <div className="text-xs text-gray-400">
                    {ds.obra?.cliente} · {formatDate(ds.criado_em)}
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${sc.bgColor} ${sc.textColor}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${sc.dotColor}`} />
                    {sc.label}
                  </div>
                  {ds.status === 'Aguardando aprovação da obra' && (
                    <button
                      onClick={e => { e.stopPropagation(); abrirModal(ds, 'aprovacao') }}
                      className="bg-[#E87722] hover:bg-[#d06a1a] text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Aprovar
                    </button>
                  )}
                  <span className="text-gray-300 text-lg">›</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Modal de confirmação de aprovação */}
      {modalTipo === 'aprovacao' && dsAtiva && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-5">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h2 className="text-base font-bold text-[#1C1C1E] mb-3">Confirmar aprovação</h2>
            <p className="text-sm text-gray-600 leading-relaxed mb-6">
              Você está aprovando a Descrição de Serviços de <strong>{dsAtiva.obra?.nome}</strong> referente
              a <strong>{dsAtiva.mes_referencia}</strong>. Esta ação é final e não pode ser desfeita pelo sistema.
              Confirma que está de acordo com o conteúdo do PDF?
            </p>
            {erroModal && <p className="text-xs text-red-500 mb-3">{erroModal}</p>}
            <div className="flex gap-3">
              <button
                onClick={fecharModal}
                disabled={processandoModal}
                className="flex-1 border border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold py-2.5 rounded-lg text-sm transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarAprovacao}
                disabled={processandoModal}
                className="flex-1 bg-[#8BAB3E] hover:bg-[#7a9a35] disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors"
              >
                {processandoModal ? 'Aprovando...' : 'Sim, aprovar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de solicitação de alteração */}
      {modalTipo === 'revisao' && dsAtiva && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-5">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h2 className="text-base font-bold text-[#1C1C1E] mb-3">Solicitar alteração</h2>
            <p className="text-sm text-gray-600 mb-3">
              DS de <strong>{dsAtiva.obra?.nome}</strong> — {dsAtiva.mes_referencia}
            </p>
            <textarea
              value={comentarioModal}
              onChange={e => setComentarioModal(e.target.value)}
              placeholder="Descreva o que precisa ser corrigido..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-[#E87722] mb-3"
              rows={3}
            />
            {erroModal && <p className="text-xs text-red-500 mb-3">{erroModal}</p>}
            <div className="flex gap-3">
              <button
                onClick={fecharModal}
                disabled={processandoModal}
                className="flex-1 border border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold py-2.5 rounded-lg text-sm transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarRevisao}
                disabled={!comentarioModal.trim() || processandoModal}
                className="flex-1 border border-[#E87722] text-[#E87722] hover:bg-orange-50 disabled:opacity-40 font-semibold py-2.5 rounded-lg text-sm transition-colors"
              >
                {processandoModal ? 'Enviando...' : 'Solicitar alteração'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
