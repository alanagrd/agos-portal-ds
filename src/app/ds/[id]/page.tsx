'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Header from '@/components/layout/Header'
import { DescricaoServico, HistoricoAcao, VersaoPDF, StatusDS, TipoDS } from '@/types'
import { STATUS_CONFIG, TIPO_CONFIG, formatDate } from '@/lib/utils'

export default function DSDetalhePage({ params }: { params: { id: string } }) {
  const [ds, setDs] = useState<DescricaoServico | null>(null)
  const [historico, setHistorico] = useState<HistoricoAcao[]>([])
  const [versoes, setVersoes] = useState<VersaoPDF[]>([])
  const [loading, setLoading] = useState(true)
  const [comentario, setComentario] = useState('')
  const [uploading, setUploading] = useState(false)
  const [userName, setUserName] = useState('AGOS')
  const [nomeCompleto, setNomeCompleto] = useState('AGOS')
  const [mostrarResolvidas, setMostrarResolvidas] = useState(false)
  const [linhasAlteracao, setLinhasAlteracao] = useState<{ id: string; nome: string; alteracao: string }[]>([])

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => { loadDS() }, [])

  const loadDS = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }
    const emailFallback = user.email?.split('@')[0] || 'AGOS'
    setUserName(emailFallback)

    const { data: usuarioAgos } = await supabase
      .from('usuarios_agos')
      .select('nome')
      .eq('id', user.id)
      .single()
    setNomeCompleto(usuarioAgos?.nome || emailFallback)

    const { data: dsData } = await supabase
      .from('descricoes_servico')
      .select('*, obra:obras(*)')
      .eq('id', params.id)
      .single()

    const { data: hist } = await supabase
      .from('historico_acoes')
      .select('*')
      .eq('ds_id', params.id)
      .order('criado_em', { ascending: true })

    const { data: vers } = await supabase
      .from('versoes_pdf')
      .select('*')
      .eq('ds_id', params.id)
      .order('numero_versao', { ascending: false })

    if (dsData) setDs(dsData)
    if (hist) setHistorico(hist)
    if (vers) setVersoes(vers)
    setLoading(false)
  }

  // "Gerada" -> "Em análise interna"
  const enviarParaAnaliseInterna = async () => {
    if (!ds) return
    await supabase.from('descricoes_servico').update({ status: 'Em análise interna' }).eq('id', ds.id)
    await supabase.from('historico_acoes').insert({
      ds_id: ds.id,
      acao: 'DS enviada para análise interna.',
      autor: userName,
      tipo: 'sistema',
    })
    router.push('/dashboard')
  }

  // "Em análise interna" -> "Aguardando aprovação da obra"
  const aprovarInternamente = async () => {
    if (!ds) return
    await supabase.from('descricoes_servico').update({ status: 'Aguardando aprovação da obra' }).eq('id', ds.id)
    await supabase.from('historico_acoes').insert({
      ds_id: ds.id,
      acao: comentario.trim()
        ? `DS aprovada internamente por ${nomeCompleto}: "${comentario.trim()}". Enviada para aprovação da obra. Link enviado para ${ds.obra?.responsavel_email}.`
        : `DS aprovada internamente por ${nomeCompleto}. Enviada para aprovação da obra. Link enviado para ${ds.obra?.responsavel_email}.`,
      autor: nomeCompleto,
      tipo: 'sistema',
    })
    setComentario('')
    loadDS()
  }

  const marcarResolvida = async (id: string) => {
    await supabase.from('historico_acoes').update({ resolvido: true }).eq('id', id)
    loadDS()
  }

  // "Aguardando aprovação da obra" -> "Em análise interna"
  const retornarParaAnaliseInterna = async () => {
    if (!ds) return
    if (!confirm('Tem certeza que deseja retornar esta DS para análise interna?')) return
    await supabase.from('descricoes_servico').update({ status: 'Em análise interna' }).eq('id', ds.id)
    await supabase.from('historico_acoes').insert({
      ds_id: ds.id,
      acao: `DS retornada para análise interna por ${nomeCompleto}.`,
      autor: nomeCompleto,
      tipo: 'sistema',
    })
    loadDS()
  }

  const adicionarLinhaAlteracao = () => {
    setLinhasAlteracao(prev => [...prev, { id: crypto.randomUUID(), nome: '', alteracao: '' }])
  }

  const atualizarLinhaAlteracao = (id: string, campo: 'nome' | 'alteracao', valor: string) => {
    setLinhasAlteracao(prev => prev.map(l => l.id === id ? { ...l, [campo]: valor } : l))
  }

  const removerLinhaAlteracao = (id: string) => {
    setLinhasAlteracao(prev => prev.filter(l => l.id !== id))
  }

  const linhasAlteracaoValidas = linhasAlteracao.length > 0 && linhasAlteracao.every(l => l.nome.trim() && l.alteracao.trim())

  const serializarAlteracoes = (linhas: { nome: string; alteracao: string }[]) =>
    linhas.map((l, i) => `${i + 1}. [${l.nome.trim()}]\n   → [${l.alteracao.trim()}]`).join('\n\n')

  // "Em análise interna" -> "Alteração solicitada"
  const solicitarAlteracao = async () => {
    if (!ds || !linhasAlteracaoValidas) return
    const texto = serializarAlteracoes(linhasAlteracao)
    await supabase.from('descricoes_servico').update({ status: 'Alteração solicitada' }).eq('id', ds.id)
    await supabase.from('historico_acoes').insert({
      ds_id: ds.id,
      acao: `Alteração solicitada internamente:\n${texto}`,
      autor: userName,
      tipo: 'interno',
    })
    setLinhasAlteracao([])
    loadDS()
  }

  const adicionarComentario = async () => {
    if (!comentario.trim() || !ds) return
    await supabase.from('historico_acoes').insert({
      ds_id: ds.id,
      acao: comentario,
      autor: userName,
      tipo: 'interno',
    })
    setComentario('')
    loadDS()
  }

  const uploadPDF = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0] || !ds) return
    setUploading(true)
    const file = e.target.files[0]
    const novaVersao = (versoes.length || 0) + 1
    const path = `${ds.id}/v${novaVersao}_${file.name}`

    const { error: uploadError } = await supabase.storage.from('ds-pdfs').upload(path, file)

    if (!uploadError) {
      await supabase.from('versoes_pdf').insert({
        ds_id: ds.id,
        numero_versao: novaVersao,
        storage_path: path,
        enviado_por: userName,
      })
      await supabase.from('historico_acoes').insert({
        ds_id: ds.id,
        acao: `PDF v${novaVersao} carregado: ${file.name}`,
        autor: userName,
        tipo: 'sistema',
      })
      if (ds.status === 'Alteração solicitada') {
        const { data: ultimaSolicitacao } = await supabase
          .from('historico_acoes')
          .select('tipo')
          .eq('ds_id', ds.id)
          .ilike('acao', 'Alteração solicitada%')
          .order('criado_em', { ascending: false })
          .limit(1)
          .single()

        const solicitadaPelaObra = ultimaSolicitacao?.tipo === 'cliente'
        const novoStatus: StatusDS = solicitadaPelaObra ? 'Aguardando aprovação da obra' : 'Em análise interna'

        await supabase.from('descricoes_servico').update({ status: novoStatus }).eq('id', ds.id)
        await supabase.from('historico_acoes').insert({
          ds_id: ds.id,
          acao: solicitadaPelaObra
            ? `PDF corrigido carregado. DS enviada novamente para aprovação da obra. Link enviado para ${ds.obra?.responsavel_email}.`
            : 'PDF corrigido carregado. DS retornada para análise interna.',
          autor: userName,
          tipo: 'sistema',
        })
      }
      loadDS()
    }
    setUploading(false)
  }

  const getPublicUrl = (path: string) => {
    const { data } = supabase.storage.from('ds-pdfs').getPublicUrl(path)
    return data.publicUrl
  }

  if (loading || !ds) {
    return (
      <div className="min-h-screen bg-[#F8F9FB]">
        <Header />
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-400 text-sm">Carregando...</p>
        </div>
      </div>
    )
  }

  const sc = STATUS_CONFIG[ds.status as StatusDS]
  const ultimaVersao = versoes[0]

  const todasAlteracoes = historico.filter(h => h.acao.startsWith('Alteração solicitada'))
  const alteracoesPendentes = todasAlteracoes.filter(h => !h.resolvido)
  const alteracoesResolvidas = todasAlteracoes.filter(h => h.resolvido)
  const aprovacaoInterna = [...historico].reverse().find(h => h.acao.startsWith('DS aprovada internamente'))

  const extrairTexto = (acao: string) => {
    const citado = acao.match(/"([^"]+)"/)
    if (citado) return citado[1]
    const idx = acao.indexOf(':')
    return idx >= 0 ? acao.slice(idx + 1).trim() : acao
  }

  const parseAlteracoesEstruturadas = (texto: string) => {
    const itens: { nome: string; alteracao: string }[] = []
    const regex = /\d+\.\s*\[([^\]]*)\]\s*\n\s*→\s*\[([^\]]*)\]/g
    let m: RegExpExecArray | null
    while ((m = regex.exec(texto))) {
      itens.push({ nome: m[1], alteracao: m[2] })
    }
    return itens
  }

  const renderConteudoAlteracao = (acao: string) => {
    const texto = extrairTexto(acao)
    const itens = parseAlteracoesEstruturadas(texto)
    if (itens.length === 0) {
      return <p className="text-sm text-gray-700">{texto}</p>
    }
    return (
      <div className="flex flex-col gap-2">
        {itens.map((item, idx) => (
          <div key={idx} className="bg-white rounded-lg border border-gray-200 p-3">
            <p className="text-xs font-semibold text-gray-700">{idx + 1}. {item.nome}</p>
            <p className="text-sm text-gray-600 mt-0.5">→ {item.alteracao}</p>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8F9FB]">
      <Header />
      <div className="max-w-5xl mx-auto px-5 py-7">

        <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-5">
          ← Voltar
        </Link>

        <div className="grid grid-cols-[1fr_320px] gap-5">

          {/* Coluna principal */}
          <div className="flex flex-col gap-4">

            {/* Card cabeçalho */}
            <div className="bg-white rounded-xl border border-gray-100 p-6">
              <div className="flex justify-between items-start mb-5">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-xs text-gray-400 uppercase tracking-wide">Descrição de Serviços</p>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${TIPO_CONFIG[ds.tipo as TipoDS]?.bgColor} ${TIPO_CONFIG[ds.tipo as TipoDS]?.textColor}`}>
                      {TIPO_CONFIG[ds.tipo as TipoDS]?.label}
                    </span>
                  </div>
                  <h1 className="text-xl font-bold text-[#111]">{ds.obra?.nome}</h1>
                  <p className="text-sm text-gray-500 mt-0.5">{ds.obra?.cliente} · {ds.mes_referencia}</p>
                </div>

                <div className="text-right">
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${sc.bgColor} ${sc.textColor}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${sc.dotColor}`} />
                    {sc.label}
                  </div>
                  {aprovacaoInterna && (
                    <p className="text-xs text-[#8BAB3E] font-medium mt-2">
                      ✓ Aprovado por {aprovacaoInterna.acao.match(/^DS aprovada internamente por (.+?)(:|\.|$)/)?.[1] || aprovacaoInterna.autor} · {formatDate(aprovacaoInterna.criado_em)}
                    </p>
                  )}
                </div>
              </div>

              {/* PDF atual */}
              {ultimaVersao ? (
                <div className="bg-gray-50 rounded-lg border border-dashed border-gray-200 p-4 flex items-center gap-4">
                  <div className="w-10 h-12 bg-[#E87722] rounded flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs font-bold">PDF</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{ultimaVersao.storage_path.split('/').pop()}</p>
                    <p className="text-xs text-gray-400 mt-0.5">v{ultimaVersao.numero_versao} · enviado por {ultimaVersao.enviado_por} · {formatDate(ultimaVersao.criado_em)}</p>
                  </div>
                  <a href={getPublicUrl(ultimaVersao.storage_path)} target="_blank" rel="noopener noreferrer"
                    className="text-sm text-[#8BAB3E] font-medium hover:underline flex-shrink-0">
                    Abrir
                  </a>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-lg border border-dashed border-gray-200 p-4 text-center text-sm text-gray-400">
                  Nenhum PDF carregado ainda
                </div>
              )}

              {/* Upload */}
              <div className="mt-3">
                <label className="cursor-pointer inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-2 bg-white">
                  <input type="file" accept=".pdf" onChange={uploadPDF} className="hidden" disabled={uploading} />
                  {uploading ? 'Enviando...' : ultimaVersao ? '↑ Enviar nova versão do PDF' : '↑ Carregar PDF'}
                </label>
                {versoes.length > 1 && (
                  <span className="text-xs text-gray-400 ml-3">{versoes.length} versões armazenadas</span>
                )}
              </div>

              {/* Gerada -> Em análise interna */}
              {ds.status === 'Gerada' && (
                <button onClick={enviarParaAnaliseInterna}
                  className="mt-4 w-full bg-[#8BAB3E] hover:bg-[#7a9a35] text-white font-semibold py-3 rounded-lg text-sm transition-colors">
                  Enviar para análise interna
                </button>
              )}

              {/* Em análise interna -> Aguardando aprovação da obra */}
              {ds.status === 'Em análise interna' && (
                <div className="mt-4 flex flex-col gap-2">
                  <textarea
                    value={comentario}
                    onChange={e => setComentario(e.target.value)}
                    placeholder="Observação (opcional)..."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-[#8BAB3E]"
                    rows={2}
                  />
                  <button
                    onClick={aprovarInternamente}
                    className="w-full bg-[#8BAB3E] hover:bg-[#7a9a35] text-white font-semibold py-2.5 rounded-lg text-sm transition-colors"
                  >
                    ✓ Aprovar internamente
                  </button>
                </div>
              )}

              {/* Solicitar alteração — disponível em "Em análise interna" e "Alteração solicitada" */}
              {(ds.status === 'Em análise interna' || ds.status === 'Alteração solicitada') && (
                <div className={ds.status === 'Em análise interna' ? 'mt-4 border-t border-gray-100 pt-4' : 'mt-4'}>
                  {ds.status === 'Alteração solicitada' && (
                    <div className="mb-3 bg-orange-50 rounded-lg p-3 text-sm text-[#E87722]">
                      Alteração solicitada. Envie o PDF corrigido acima para retornar automaticamente para análise interna. Você pode incluir novas alterações abaixo enquanto isso.
                    </div>
                  )}
                  <p className="text-xs font-semibold text-gray-500 mb-2">Solicitar alteração por funcionário</p>
                  {linhasAlteracao.length > 0 && (
                    <div className="flex flex-col gap-2 mb-2">
                      {linhasAlteracao.map((linha, idx) => (
                        <div key={linha.id} className="flex gap-2 items-start bg-gray-50 rounded-lg p-3">
                          <span className="text-xs font-semibold text-gray-400 mt-2.5">{idx + 1}.</span>
                          <div className="flex-1 flex flex-col gap-2">
                            <input
                              value={linha.nome}
                              onChange={e => atualizarLinhaAlteracao(linha.id, 'nome', e.target.value)}
                              placeholder="Nome do funcionário"
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#E87722]"
                            />
                            <input
                              value={linha.alteracao}
                              onChange={e => atualizarLinhaAlteracao(linha.id, 'alteracao', e.target.value)}
                              placeholder="Alteração necessária"
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#E87722]"
                            />
                          </div>
                          <button
                            onClick={() => removerLinhaAlteracao(linha.id)}
                            className="text-gray-300 hover:text-red-500 mt-2.5"
                            title="Remover"
                          >
                            🗑
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={adicionarLinhaAlteracao}
                    className="text-xs font-semibold text-[#8BAB3E] hover:underline"
                  >
                    + Adicionar funcionário
                  </button>
                  <button
                    onClick={solicitarAlteracao}
                    disabled={!linhasAlteracaoValidas}
                    className="mt-3 w-full border border-[#E87722] text-[#E87722] hover:bg-orange-50 disabled:opacity-40 font-semibold py-2.5 rounded-lg text-sm transition-colors"
                  >
                    Solicitar alteração
                  </button>
                </div>
              )}

              {ds.status === 'Aguardando aprovação da obra' && (
                <div className="mt-4 flex flex-col gap-2">
                  <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-700">
                    Link enviado para <strong>{ds.obra?.responsavel_nome}</strong> ({ds.obra?.responsavel_email}). Aguardando resposta da obra.
                  </div>
                  <button
                    onClick={retornarParaAnaliseInterna}
                    className="self-start text-xs text-gray-500 border border-gray-200 hover:bg-gray-50 font-medium px-3 py-1.5 rounded-lg transition-colors"
                  >
                    ↩ Retornar para análise interna
                  </button>
                </div>
              )}

              {ds.status === 'Aprovada' && (
                <div className="mt-4 bg-green-50 rounded-lg p-3 text-sm text-green-700 font-medium text-center">
                  ✓ DS aprovada pelo cliente
                </div>
              )}
            </div>

            {/* Alterações solicitadas */}
            {todasAlteracoes.length > 0 && (
              <div className={`bg-white rounded-xl border-2 p-5 ${alteracoesPendentes.length > 0 ? 'border-[#E87722]' : 'border-gray-100'}`}>
                {alteracoesPendentes.length > 0 && (
                  <p className="text-sm font-bold text-[#E87722] mb-3">
                    ⚠️ Alterações solicitadas ({alteracoesPendentes.length})
                  </p>
                )}
                {alteracoesPendentes.length > 0 && (
                  <div className="flex flex-col gap-3">
                    {alteracoesPendentes.map(ev => (
                      <div key={ev.id} className="bg-orange-50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                            ev.tipo === 'cliente' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {ev.tipo === 'cliente' ? 'Obra' : 'ADM Interno'}
                          </span>
                          <span className="text-xs text-gray-400">{ev.autor} · {formatDate(ev.criado_em)}</span>
                        </div>
                        <div className="mb-3">{renderConteudoAlteracao(ev.acao)}</div>
                        <button
                          onClick={() => marcarResolvida(ev.id)}
                          className="text-xs font-semibold text-[#E87722] border border-[#E87722] hover:bg-orange-100 rounded-lg px-3 py-1.5 transition-colors"
                        >
                          Marcar como resolvida
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {alteracoesResolvidas.length > 0 && (
                  <div className={alteracoesPendentes.length > 0 ? 'mt-4 pt-4 border-t border-gray-100' : ''}>
                    <button
                      onClick={() => setMostrarResolvidas(v => !v)}
                      className="text-xs font-semibold text-gray-500 hover:text-gray-700 flex items-center gap-1.5"
                    >
                      <span>{mostrarResolvidas ? '▾' : '▸'}</span>
                      {alteracoesResolvidas.length} alteração{alteracoesResolvidas.length > 1 ? 'ões' : ''} já resolvida{alteracoesResolvidas.length > 1 ? 's' : ''}
                    </button>
                    {mostrarResolvidas && (
                      <div className="flex flex-col gap-3 mt-3">
                        {alteracoesResolvidas.map(ev => (
                          <div key={ev.id} className="bg-gray-50 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                                ev.tipo === 'cliente' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                              }`}>
                                {ev.tipo === 'cliente' ? 'Obra' : 'ADM Interno'}
                              </span>
                              <span className="text-xs font-medium text-[#8BAB3E]">✓ Resolvida</span>
                            </div>
                            <div className="mb-1">{renderConteudoAlteracao(ev.acao)}</div>
                            <p className="text-xs text-gray-400">{ev.autor} · {formatDate(ev.criado_em)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Observação interna */}
            {ds.status !== 'Aprovada' && ds.status !== 'Em análise interna' && (
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <p className="text-sm font-semibold text-gray-700 mb-3">Adicionar observação interna</p>
                <textarea
                  value={comentario}
                  onChange={e => setComentario(e.target.value)}
                  placeholder="Registre uma alteração, correção ou observação..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-[#8BAB3E]"
                  rows={3}
                />
                <button
                  onClick={adicionarComentario}
                  disabled={!comentario.trim()}
                  className="mt-2 bg-[#1C1C1E] hover:bg-[#333] disabled:bg-gray-100 disabled:text-gray-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  Salvar observação
                </button>
              </div>
            )}

            {/* Versões anteriores */}
            {versoes.length > 1 && (
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <p className="text-sm font-semibold text-gray-700 mb-3">Versões anteriores</p>
                <div className="flex flex-col gap-2">
                  {versoes.slice(1).map(v => (
                    <div key={v.id} className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">v{v.numero_versao} · {formatDate(v.criado_em)}</span>
                      <a href={getPublicUrl(v.storage_path)} target="_blank" rel="noopener noreferrer"
                        className="text-[#8BAB3E] hover:underline text-xs">
                        Abrir
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-xl border border-gray-100 p-5 h-fit">
            <p className="text-sm font-semibold text-gray-700 mb-4">Histórico</p>
            <div className="flex flex-col">
              {historico.map((ev, i) => (
                <div key={ev.id} className="flex gap-3 pb-4 relative">
                  <div className="flex flex-col items-center">
                    <div className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${
                      ev.tipo === 'cliente' ? 'bg-blue-400' :
                      ev.tipo === 'interno' ? 'bg-amber-400' : 'bg-gray-300'
                    }`} />
                    {i < historico.length - 1 && <div className="w-px flex-1 bg-gray-100 mt-1" />}
                  </div>
                  <div className="flex-1 pb-1">
                    <p className={`text-xs leading-relaxed whitespace-pre-line ${
                      ev.tipo === 'cliente' ? 'text-blue-700 font-medium' :
                      ev.tipo === 'interno' ? 'text-gray-700' : 'text-gray-400'
                    }`}>
                      {ev.acao}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {ev.autor} · {formatDate(ev.criado_em)}
                    </p>
                  </div>
                </div>
              ))}
              {historico.length === 0 && <p className="text-xs text-gray-400">Nenhuma ação registrada.</p>}
            </div>

            <div className="mt-2 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-400 mb-1">Responsável na obra</p>
              <p className="text-sm font-medium text-gray-700">{ds.obra?.responsavel_nome}</p>
              <p className="text-xs text-gray-400">{ds.obra?.responsavel_email}</p>
              {ds.obra?.emails_copia && ds.obra.emails_copia.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-gray-400 mb-1">Em cópia</p>
                  {ds.obra.emails_copia.map((email, i) => (
                    <p key={i} className="text-xs text-gray-400">{email}</p>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
