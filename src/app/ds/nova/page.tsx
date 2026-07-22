'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Header from '@/components/layout/Header'
import { Obra, TipoDS } from '@/types'
import { TIPO_CONFIG } from '@/lib/utils'

export default function NovaDSPage() {
  const [obras, setObras] = useState<Obra[]>([])
  const [obraId, setObraId] = useState('')
  const [mes, setMes] = useState('')
  const [tipo, setTipo] = useState<TipoDS>('OUTROS')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [userName, setUserName] = useState('AGOS')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      setUserName(user.email?.split('@')[0] || 'AGOS')

      const { data } = await supabase.from('obras').select('*').eq('ativa', true).order('nome')
      if (data) setObras(data)
    }
    init()
  }, [])

  const handleSubmit = async () => {
    if (!obraId || !mes) return
    setLoading(true)

    // Criar DS
    const { data: novaDS, error } = await supabase
      .from('descricoes_servico')
      .insert({ obra_id: obraId, mes_referencia: mes, status: 'Gerada', tipo })
      .select()
      .single()

    if (error || !novaDS) { setLoading(false); return }

    // Registrar no histórico
    await supabase.from('historico_acoes').insert({
      ds_id: novaDS.id,
      acao: 'DS criada e cadastrada no sistema.',
      autor: userName,
      tipo: 'sistema',
    })

    // Upload do PDF se tiver
    if (arquivo) {
      const nomeSeguro = arquivo.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${novaDS.id}/v1_${nomeSeguro}`
      const { error: uploadError } = await supabase.storage
        .from('ds-pdfs')
        .upload(path, arquivo)

      if (!uploadError) {
        await supabase.from('versoes_pdf').insert({
          ds_id: novaDS.id,
          numero_versao: 1,
          storage_path: path,
          enviado_por: userName,
        })

        await supabase.from('historico_acoes').insert({
          ds_id: novaDS.id,
          acao: `PDF v1 carregado: ${arquivo.name}`,
          autor: userName,
          tipo: 'sistema',
        })
      }
    }

    router.push(`/ds/${novaDS.id}`)
  }

  const valido = obraId && mes

  return (
    <div className="min-h-screen bg-[#F8F9FB]">
      <Header />
      <div className="max-w-lg mx-auto px-5 py-7">
        <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-6">
          ← Voltar
        </Link>

        <div className="bg-white rounded-xl border border-gray-100 p-8">
          <h1 className="text-lg font-bold text-[#111] mb-1">Nova DS</h1>
          <p className="text-sm text-gray-400 mb-6">Cadastre uma nova Descrição de Serviços</p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Obra</label>
              <select
                value={obraId}
                onChange={e => setObraId(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#8BAB3E]"
              >
                <option value="">Selecione a obra</option>
                {obras.map(o => (
                  <option key={o.id} value={o.id}>{o.nome} — {o.cliente}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Mês de referência</label>
              <input
                value={mes}
                onChange={e => setMes(e.target.value)}
                placeholder="Ex: Junho/2026"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#8BAB3E]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Tipo</label>
              <select
                value={tipo}
                onChange={e => setTipo(e.target.value as TipoDS)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#8BAB3E]"
              >
                {Object.keys(TIPO_CONFIG).map(t => (
                  <option key={t} value={t}>{TIPO_CONFIG[t as TipoDS].label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">PDF da DS <span className="text-gray-400 font-normal">(opcional)</span></label>
              <label className="cursor-pointer flex items-center gap-3 border border-dashed border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                <input
                  type="file"
                  accept=".pdf"
                  onChange={e => setArquivo(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <div className="w-8 h-10 bg-[#E87722] rounded flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-bold">PDF</span>
                </div>
                <span className="text-sm text-gray-500">
                  {arquivo ? arquivo.name : 'Clique para selecionar o PDF'}
                </span>
              </label>
            </div>

            <button
              onClick={handleSubmit}
              disabled={!valido || loading}
              className="w-full bg-[#8BAB3E] hover:bg-[#7a9a35] disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold py-3 rounded-lg text-sm transition-colors mt-2"
            >
              {loading ? 'Criando...' : 'Criar DS'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
