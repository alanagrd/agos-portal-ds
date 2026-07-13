'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DescricaoServico, VersaoPDF } from '@/types'

export default function AprovarPage({ params }: { params: { token: string } }) {
  const [ds, setDs] = useState<DescricaoServico | null>(null)
  const [versao, setVersao] = useState<VersaoPDF | null>(null)
  const [loading, setLoading] = useState(true)
  const [comentario, setComentario] = useState('')
  const [acao, setAcao] = useState<'aprovando' | 'revisando' | null>(null)
  const [concluido, setConcluido] = useState<'aprovada' | 'revisao' | null>(null)
  const supabase = createClient()

  useEffect(() => { loadDS() }, [])

  const loadDS = async () => {
    const { data: dsData } = await supabase
      .from('descricoes_servico')
      .select('*, obra:obras(*)')
      .eq('token_aprovacao', params.token)
      .single()

    if (dsData) {
      setDs(dsData)
      const { data: versaoData } = await supabase
        .from('versoes_pdf')
        .select('*')
        .eq('ds_id', dsData.id)
        .order('numero_versao', { ascending: false })
        .limit(1)
        .single()
      if (versaoData) setVersao(versaoData)
    }
    setLoading(false)
  }

  const getPublicUrl = (path: string) => {
    const { data } = supabase.storage.from('ds-pdfs').getPublicUrl(path)
    return data.publicUrl
  }

  const buscarAdminEmail = async (dsId: string): Promise<string | null> => {
    const { data } = await supabase
      .from('historico_acoes')
      .select('autor_email')
      .eq('ds_id', dsId)
      .ilike('acao', 'DS aprovada internamente%')
      .order('criado_em', { ascending: false })
      .limit(1)
      .single()
    return data?.autor_email ?? null
  }

  const aprovar = async () => {
    if (!ds) return
    setAcao('aprovando')

    await supabase.from('descricoes_servico').update({ status: 'Aprovada' }).eq('id', ds.id)
    await supabase.from('historico_acoes').insert({
      ds_id: ds.id,
      acao: 'DS aprovada sem ressalvas.',
      autor: ds.obra?.responsavel_nome || 'Cliente',
      tipo: 'cliente',
    })

    buscarAdminEmail(ds.id).then(adminEmail => {
      if (!adminEmail) return
      fetch('/api/email/obra-aprovou', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dsId: ds.id,
          obraNome: ds.obra?.nome,
          mesReferencia: ds.mes_referencia,
          adminEmail,
        }),
      }).catch(err => console.error('[email/obra-aprovou]', err))
    }).catch(err => console.error('[buscarAdminEmail]', err))

    setConcluido('aprovada')
    setAcao(null)
  }

  const solicitarRevisao = async () => {
    if (!ds || !comentario.trim()) return
    setAcao('revisando')

    await supabase.from('descricoes_servico').update({ status: 'Alteração solicitada' }).eq('id', ds.id)
    await supabase.from('historico_acoes').insert({
      ds_id: ds.id,
      acao: `Alteração solicitada pela obra: "${comentario}"`,
      autor: ds.obra?.responsavel_nome || 'Cliente',
      tipo: 'cliente',
    })

    buscarAdminEmail(ds.id).then(adminEmail => {
      if (!adminEmail) return
      fetch('/api/email/obra-solicitou-alteracao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dsId: ds.id,
          obraNome: ds.obra?.nome,
          mesReferencia: ds.mes_referencia,
          adminEmail,
          comentario: comentario.trim(),
        }),
      }).catch(err => console.error('[email/obra-solicitou-alteracao]', err))
    }).catch(err => console.error('[buscarAdminEmail]', err))

    setConcluido('revisao')
    setAcao(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FB] flex items-center justify-center">
        <p className="text-gray-400 text-sm">Carregando...</p>
      </div>
    )
  }

  if (!ds) {
    return (
      <div className="min-h-screen bg-[#F8F9FB] flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-700 font-medium">Link inválido ou expirado.</p>
          <p className="text-gray-400 text-sm mt-1">Entre em contato com a AGOS Serviços.</p>
        </div>
      </div>
    )
  }

  if (concluido === 'aprovada') {
    return (
      <div className="min-h-screen bg-[#F8F9FB] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-green-600 text-2xl">✓</span>
          </div>
          <p className="text-lg font-bold text-[#111]">DS Aprovada!</p>
          <p className="text-gray-400 text-sm mt-1">A AGOS Serviços foi notificada da sua aprovação.</p>
        </div>
      </div>
    )
  }

  if (concluido === 'revisao') {
    return (
      <div className="min-h-screen bg-[#F8F9FB] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-orange-600 text-2xl">!</span>
          </div>
          <p className="text-lg font-bold text-[#111]">Alteração solicitada</p>
          <p className="text-gray-400 text-sm mt-1">A AGOS Serviços recebeu sua solicitação e irá corrigir em breve.</p>
        </div>
      </div>
    )
  }

  if (ds.status === 'Aprovada') {
    return (
      <div className="min-h-screen bg-[#F8F9FB] flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-700 font-medium">Esta DS já foi aprovada anteriormente.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8F9FB]">
      {/* Header simples */}
      <div className="bg-[#1C1C1E] h-14 px-6 flex items-center gap-3">
        <div className="w-7 h-7 bg-[#8BAB3E] rounded-md flex items-center justify-center">
          <span className="text-white text-sm font-bold">A</span>
        </div>
        <span className="text-white font-semibold text-sm">AGOS Serviços</span>
        <span className="text-gray-500 text-sm">/ Aprovação de DS</span>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-8">
        {/* Info da DS */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 mb-5">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Descrição de Serviços para aprovação</p>
          <h1 className="text-xl font-bold text-[#111]">{ds.obra?.nome}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{ds.obra?.cliente} · {ds.mes_referencia}</p>

          {/* PDF */}
          {versao ? (
            <div className="mt-5 bg-gray-50 rounded-lg border border-dashed border-gray-200 p-4 flex items-center gap-4">
              <div className="w-10 h-12 bg-[#E87722] rounded flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-bold">PDF</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-700">Descrição de Serviços — {ds.mes_referencia}</p>
                <p className="text-xs text-gray-400 mt-0.5">Versão {versao.numero_versao}</p>
              </div>
              <a
                href={getPublicUrl(versao.storage_path)}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-[#8BAB3E] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#7a9a35] transition-colors"
              >
                Visualizar PDF
              </a>
            </div>
          ) : (
            <div className="mt-5 bg-gray-50 rounded-lg p-4 text-center text-sm text-gray-400">
              PDF ainda não disponível. Entre em contato com a AGOS.
            </div>
          )}
        </div>

        {/* Ações */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <p className="text-sm font-semibold text-gray-700 mb-4">Sua avaliação</p>

          {/* Aprovação */}
          <button
            onClick={aprovar}
            disabled={!!acao}
            className="w-full bg-[#8BAB3E] hover:bg-[#7a9a35] disabled:opacity-60 text-white font-semibold py-3 rounded-lg text-sm transition-colors mb-4"
          >
            {acao === 'aprovando' ? 'Aprovando...' : '✓ Aprovar DS'}
          </button>

          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-100" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-3 text-xs text-gray-400">ou solicitar alteração</span>
            </div>
          </div>

          {/* Solicitar alteração */}
          <textarea
            value={comentario}
            onChange={e => setComentario(e.target.value)}
            placeholder="Descreva o que precisa ser corrigido..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-[#E87722] mb-3"
            rows={3}
          />
          <button
            onClick={solicitarRevisao}
            disabled={!comentario.trim() || !!acao}
            className="w-full border border-[#E87722] text-[#E87722] hover:bg-orange-50 disabled:opacity-40 font-semibold py-2.5 rounded-lg text-sm transition-colors"
          >
            {acao === 'revisando' ? 'Enviando...' : '✏️ Solicitar alteração'}
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 mt-5">
          AGOS Serviços · info@agosservicos.com.br · (11) 4123-0831
        </p>
      </div>
    </div>
  )
}
