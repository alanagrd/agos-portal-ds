'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/layout/Header'
import { createClient } from '@/lib/supabase/client'
import { Obra } from '@/types'

export default function ObrasPage() {
  const [obras, setObras] = useState<Obra[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [nome, setNome] = useState('')
  const [cliente, setCliente] = useState('')
  const [respNome, setRespNome] = useState('')
  const [respEmail, setRespEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => { loadObras() }, [])

  const loadObras = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    const { data } = await supabase.from('obras').select('*').order('nome')
    if (data) setObras(data)
    setLoading(false)
  }

  const salvarObra = async () => {
    if (!nome || !cliente || !respNome || !respEmail) return
    setSaving(true)

    await supabase.from('obras').insert({
      nome, cliente,
      responsavel_nome: respNome,
      responsavel_email: respEmail,
    })

    setNome(''); setCliente(''); setRespNome(''); setRespEmail('')
    setShowForm(false)
    setSaving(false)
    loadObras()
  }

  const toggleAtiva = async (obra: Obra) => {
    await supabase.from('obras').update({ ativa: !obra.ativa }).eq('id', obra.id)
    loadObras()
  }

  return (
    <div className="min-h-screen bg-[#F8F9FB]">
      <Header />
      <div className="max-w-3xl mx-auto px-5 py-7">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-bold text-[#111]">Obras</h1>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-[#8BAB3E] hover:bg-[#7a9a35] text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            + Nova Obra
          </button>
        </div>

        {/* Formulário nova obra */}
        {showForm && (
          <div className="bg-white rounded-xl border border-gray-100 p-6 mb-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Nova obra</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Nome da obra', val: nome, set: setNome, placeholder: 'Ex: Edifício Horizonte' },
                { label: 'Construtora / Cliente', val: cliente, set: setCliente, placeholder: 'Ex: LBL Engenharia' },
                { label: 'Responsável (nome)', val: respNome, set: setRespNome, placeholder: 'Ex: Eng. Ricardo Matos' },
                { label: 'Responsável (e-mail)', val: respEmail, set: setRespEmail, placeholder: 'ricardo@lbl.com.br' },
              ].map(f => (
                <div key={f.label}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
                  <input
                    value={f.val}
                    onChange={e => f.set(e.target.value)}
                    placeholder={f.placeholder}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#8BAB3E]"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={salvarObra}
                disabled={saving || !nome || !cliente || !respNome || !respEmail}
                className="bg-[#8BAB3E] hover:bg-[#7a9a35] disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Lista obras */}
        {loading ? (
          <p className="text-sm text-gray-400 text-center py-12">Carregando...</p>
        ) : (
          <div className="flex flex-col gap-3">
            {obras.map(obra => (
              <div key={obra.id} className="bg-white rounded-xl border border-gray-100 px-6 py-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#111] text-sm">{obra.nome}</span>
                    {!obra.ativa && (
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inativa</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{obra.cliente} · {obra.responsavel_nome} · {obra.responsavel_email}</p>
                </div>
                <button
                  onClick={() => toggleAtiva(obra)}
                  className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors"
                >
                  {obra.ativa ? 'Desativar' : 'Ativar'}
                </button>
              </div>
            ))}
            {obras.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-12">Nenhuma obra cadastrada.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
