'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Header from '@/components/layout/Header'
import { DescricaoServico, HistoricoAcao, VersaoPDF, StatusDS } from '@/types'
import { STATUS_CONFIG, formatDate } from '@/lib/utils'

export default function DSDetalhePage({ params }: { params: { id: string } }) {
  const [ds, setDs] = useState<DescricaoServico | null>(null)
  const [historico, setHistorico] = useState<HistoricoAcao[]>([])
  const [versoes, setVersoes] = useState<VersaoPDF[]>([])
  const [loading, setLoading] = useState(true)
  const [comentario, setComentario] = useState('')
  const [uploading, setUploading] = useState(false)
  const [userName, setUserName] = useState('AGOS')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => { loadDS() }, [])

  const loadDS = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }
    setUserName(user.email?.split('@')[0] || 'AGOS')

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

  const avancarStatus = async () => {
    if (!ds) return
    const sc = STATUS_CONFIG[ds.status as StatusDS]
    const nextStatus = sc.next
    if (!nextStatus) return

    const acaoMap: Record<string, string> = {
      'Em conferência interna': 'DS enviada para conferência interna.',
      'Aguardando aprovação': `DS enviada para aprovação da obra. Link de aprovação enviado para ${ds.obra?.responsavel_email}.`,
      'Aprovada': 'DS aprovada.',
    }

    await supabase
      .from('descricoes_servico')
      .update({ status: nextStatus })
      .eq('id', ds.id)

    await supabase.from('historico_acoes').insert({
      ds_id: ds.id,
      acao: acaoMap[nextStatus] || `Status atualizado para ${nextStatus}`,
      autor: userName,
      tipo: 'sistema',
    })

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

    const { error: uploadError } = await supabase.storage
      .from('ds-pdfs')
      .upload(path, file)

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

      // Se estava em revisão, volta automaticamente para conferência interna
      if (ds.status === 'Em revisão') {
        await supabase
          .from('descricoes_servico')
          .update({ status: 'Em conferência interna' })
          .eq('id', ds.id)
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
  const linkCliente = `${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('.supabase.co/rest/v1/', '') || ''}/aprovar/${ds.token_aprovacao}`

  return (
    <div className="min-h-screen bg-[#F8F9FB]">
      <Header />
      <div className="max-w-5xl mx-auto px-5 py-7">

        {/* Voltar */}
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
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Descrição de Serviços</p>
                  <h1 className="text-xl font-bold text-[#111]">{ds.obra?.nome}</h1>
                  <p className="text-sm text-gray-500 mt-0.5">{ds.obra?.cliente} · {ds.mes_referencia}</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-[#111]">{ds.valor_total}</div>
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium mt-2 ${sc.bgColor} ${sc.textColor}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${sc.dotColor}`} />
                    {sc.label}
                  </div>
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
                  <a
                    href={getPublicUrl(ultimaVersao.storage_path)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-[#8BAB3E] font-medium hover:underline flex-shrink-0"
                  >
                    Abrir
                  </a>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-lg border border-dashed border-gray-200 p-4 text-center text-sm text-gray-400">
                  Nenhum PDF carregado ainda
                </div>
              )}

              {/* Upload nova versão */}
              <div className="mt-3">
                <label className="cursor-pointer inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-2 bg-white">
                  <input type="file" accept=".pdf" onChange={uploadPDF} className="hidden" disabled={uploading} />
                  {uploading ? 'Enviando...' : ultimaVersao ? '↑ Enviar nova versão do PDF' : '↑ Carregar PDF'}
                </label>
                {versoes.length > 1 && (
                  <span className="text-xs text-gray-400 ml-3">{versoes.length} versões armazenadas</span>
                )}
              </div>

              {/* Botão avançar status */}
              {sc.btnLabel && (
                <button
                  onClick={avancarStatus}
                  className="mt-4 w-full bg-[#8BAB3E] hover:bg-[#7a9a35] text-white font-semibold py-3 rounded-lg text-sm transition-colors"
                >
                  {sc.btnLabel}
                </button>
              )}

              {ds.status === 'Aguardando aprovação' && (
                <div className="mt-4 bg-blue-50 rounded-lg p-3 text-sm text-blue-700">
                  Link enviado para <strong>{ds.obra?.responsavel_nome}</strong> ({ds.obra?.responsavel_email})
                </div>
              )}

              {ds.status === 'Aprovada' && (
                <div className="mt-4 bg-green-50 rounded-lg p-3 text-sm text-green-700 font-medium text-center">
                  ✓ DS aprovada pelo cliente
                </div>
              )}
            </div>

            {/* Observação interna */}
            {ds.status !== 'Aprovada' && (
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
                      <a
                        href={getPublicUrl(v.storage_path)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#8BAB3E] hover:underline text-xs"
                      >
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
                    {i < historico.length - 1 && (
                      <div className="w-px flex-1 bg-gray-100 mt-1" />
                    )}
                  </div>
                  <div className="flex-1 pb-1">
                    <p className={`text-xs leading-relaxed ${
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
              {historico.length === 0 && (
                <p className="text-xs text-gray-400">Nenhuma ação registrada.</p>
              )}
            </div>

            {/* Responsável */}
            <div className="mt-2 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-400 mb-1">Responsável na obra</p>
              <p className="text-sm font-medium text-gray-700">{ds.obra?.responsavel_nome}</p>
              <p className="text-xs text-gray-400">{ds.obra?.responsavel_email}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
