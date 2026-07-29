'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import HeaderCliente from '@/components/layout/HeaderCliente'
import { DescricaoServico, VersaoPDF, HistoricoAcao, StatusDS, TipoDS } from '@/types'
import { STATUS_CONFIG, TIPO_CONFIG, formatDate } from '@/lib/utils'

export default function ClienteDSPage({ params }: { params: { id: string } }) {
  const [ds, setDs] = useState<DescricaoServico | null>(null)
  const [versoes, setVersoes] = useState<VersaoPDF[]>([])
  const [historico, setHistorico] = useState<HistoricoAcao[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => { loadDS() }, [])

  const loadDS = async () => {
    const { data: dsData } = await supabase
      .from('descricoes_servico')
      .select('*, obra:obras(*)')
      .eq('id', params.id)
      .single()

    if (!dsData) {
      setLoading(false)
      return
    }
    setDs(dsData)

    const [{ data: versoesData }, { data: historicoData }] = await Promise.all([
      supabase
        .from('versoes_pdf')
        .select('*')
        .eq('ds_id', params.id)
        .order('numero_versao', { ascending: false }),
      supabase
        .from('historico_acoes')
        .select('*')
        .eq('ds_id', params.id)
        .order('criado_em', { ascending: true }),
    ])

    setVersoes(versoesData ?? [])
    setHistorico(historicoData ?? [])
    setLoading(false)
  }

  const getPublicUrl = (path: string) =>
    supabase.storage.from('ds-pdfs').getPublicUrl(path).data.publicUrl

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

  if (!ds) {
    return (
      <div className="min-h-screen bg-[#F8F9FB]">
        <HeaderCliente />
        <div className="flex items-center justify-center h-64 text-center">
          <div>
            <p className="text-gray-700 font-medium">DS não encontrada.</p>
            <Link href="/cliente" className="text-sm text-[#8BAB3E] mt-2 block hover:underline">
              ← Voltar
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const sc = STATUS_CONFIG[ds.status as StatusDS]
  const tc = TIPO_CONFIG[ds.tipo as TipoDS] || TIPO_CONFIG.OUTROS
  const ultimaVersao = versoes[0]

  return (
    <div className="min-h-screen bg-[#F8F9FB]">
      <HeaderCliente />
      <div className="max-w-3xl mx-auto px-5 py-7">

        {/* Cabeçalho */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 mb-5">
          <Link href="/cliente" className="text-xs text-gray-400 hover:text-gray-600 mb-3 block">
            ← Voltar
          </Link>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-[#111]">{ds.obra?.nome}</h1>
              <p className="text-sm text-gray-500 mt-0.5">{ds.obra?.cliente}</p>
              <div className="flex items-center gap-2 mt-3">
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${tc.bgColor} ${tc.textColor}`}>
                  {tc.label}
                </span>
                <span className="text-gray-300">·</span>
                <span className="text-sm text-gray-600">{ds.mes_referencia}</span>
              </div>
            </div>
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium flex-shrink-0 ${sc.bgColor} ${sc.textColor}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${sc.dotColor}`} />
              {sc.label}
            </div>
          </div>
          {ds.status === 'Aguardando aprovação da obra' && (
            <div className="mt-4">
              <a
                href={`/aprovar/${ds.token_aprovacao}`}
                className="inline-block bg-[#E87722] hover:bg-[#d06a1a] text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
              >
                Aprovar ou solicitar alteração
              </a>
            </div>
          )}
        </div>

        {/* PDF */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 mb-5">
          <p className="text-sm font-semibold text-gray-700 mb-4">Documento</p>
          {ultimaVersao ? (
            <>
              <iframe
                src={getPublicUrl(ultimaVersao.storage_path)}
                className="w-full rounded-lg border border-gray-100"
                style={{ height: '520px' }}
                title="PDF da DS"
              />
              <p className="text-xs text-gray-400 mt-2">
                Versão {ultimaVersao.numero_versao} · {formatDate(ultimaVersao.criado_em)}
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-400">PDF ainda não disponível.</p>
          )}

          {versoes.length > 1 && (
            <div className="mt-4 border-t border-gray-100 pt-4">
              <p className="text-xs text-gray-500 mb-2">Versões anteriores</p>
              <div className="space-y-1.5">
                {versoes.slice(1).map(v => (
                  <a
                    key={v.id}
                    href={getPublicUrl(v.storage_path)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-[#8BAB3E] hover:underline"
                  >
                    v{v.numero_versao} · {formatDate(v.criado_em)}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Histórico (tipo='interno' já filtrado pela RLS) */}
        {historico.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <p className="text-sm font-semibold text-gray-700 mb-4">Histórico</p>
            <div className="space-y-3">
              {historico.map(h => (
                <div key={h.id} className="flex gap-3">
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                    h.tipo === 'cliente' ? 'bg-blue-400' : 'bg-gray-300'
                  }`} />
                  <div>
                    <p className="text-sm text-gray-700">{h.acao}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{h.autor} · {formatDate(h.criado_em)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
