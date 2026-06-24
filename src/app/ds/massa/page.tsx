'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Header from '@/components/layout/Header'
import { Obra, TipoDS } from '@/types'
import { TIPO_CONFIG, autoMatchTipo } from '@/lib/utils'

function formatBRL(raw: string) {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  const num = parseInt(digits, 10) / 100
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function mesAtual() {
  return new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    .replace(/^\w/, c => c.toUpperCase())
    .replace(' de ', '/')
}

function autoMatchObra(filename: string, obras: Obra[]): string {
  const nome = filename.toLowerCase().replace(/[-_]/g, ' ').replace(/\.pdf$/i, '')
  let melhor = ''
  let melhorScore = 0
  for (const obra of obras) {
    const palavrasObra = obra.nome.toLowerCase().split(/\s+/)
    const palavrasCliente = obra.cliente.toLowerCase().split(/\s+/)
    const todas = [...palavrasObra, ...palavrasCliente]
    const score = todas.filter(p => p.length > 2 && nome.includes(p)).length
    if (score > melhorScore) {
      melhorScore = score
      melhor = obra.id
    }
  }
  return melhorScore > 0 ? melhor : ''
}

interface Item {
  id: string
  file: File
  obraId: string
  mes: string
  valor: string
  tipo: TipoDS
}

export default function DSMassaPage() {
  const [obras, setObras] = useState<Obra[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [mesGlobal, setMesGlobal] = useState(mesAtual())
  const [dragOver, setDragOver] = useState(false)
  const [criando, setCriando] = useState(false)
  const [progresso, setProgresso] = useState(0)
  const [userName, setUserName] = useState('AGOS')
  const inputRef = useRef<HTMLInputElement>(null)
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

  const adicionarArquivos = (files: FileList | null) => {
    if (!files) return
    const pdfs = Array.from(files).filter(f => f.type === 'application/pdf')
    const novos: Item[] = pdfs.map(file => ({
      id: crypto.randomUUID(),
      file,
      obraId: autoMatchObra(file.name, obras),
      mes: mesGlobal,
      valor: '',
      tipo: autoMatchTipo(file.name),
    }))
    setItems(prev => [...prev, ...novos])
  }

  const atualizar = (id: string, campo: Exclude<keyof Item, 'id' | 'file'>, valor: string | TipoDS) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [campo]: valor } : i))
  }

  const remover = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id))
  }

  const aplicarMesGlobal = (mes: string) => {
    setMesGlobal(mes)
    setItems(prev => prev.map(i => ({ ...i, mes })))
  }

  const valido = items.length > 0 && items.every(i => i.obraId && i.mes && i.valor)

  const criarTodas = async () => {
    if (!valido) return
    setCriando(true)
    setProgresso(0)

    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx]

      // Criar DS
      const { data: novaDS, error } = await supabase
        .from('descricoes_servico')
        .insert({ obra_id: item.obraId, mes_referencia: item.mes, valor_total: item.valor, status: 'Gerada', tipo: item.tipo })
        .select()
        .single()

      if (error || !novaDS) continue

      // Histórico criação
      await supabase.from('historico_acoes').insert({
        ds_id: novaDS.id,
        acao: 'DS criada via upload em massa.',
        autor: userName,
        tipo: 'sistema',
      })

      // Upload PDF
      const path = `${novaDS.id}/v1_${item.file.name}`
      const { error: uploadError } = await supabase.storage
        .from('ds-pdfs')
        .upload(path, item.file)

      if (!uploadError) {
        await supabase.from('versoes_pdf').insert({
          ds_id: novaDS.id,
          numero_versao: 1,
          storage_path: path,
          enviado_por: userName,
        })
        await supabase.from('historico_acoes').insert({
          ds_id: novaDS.id,
          acao: `PDF v1 carregado: ${item.file.name}`,
          autor: userName,
          tipo: 'sistema',
        })
      }

      setProgresso(Math.round(((idx + 1) / items.length) * 100))
    }

    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-[#F8F9FB]">
      <Header />
      <div className="max-w-5xl mx-auto px-5 py-7">

        <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-5">
          ← Voltar
        </Link>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-bold text-[#111]">Upload em massa</h1>
            <p className="text-sm text-gray-400 mt-0.5">Crie várias DSs de uma vez arrastando os PDFs</p>
          </div>

          {/* Mês global */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600 whitespace-nowrap">Mês para todos:</label>
            <input
              value={mesGlobal}
              onChange={e => aplicarMesGlobal(e.target.value)}
              placeholder="Ex: Junho/2026"
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#8BAB3E] w-40"
            />
          </div>
        </div>

        {/* Área de drop */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); adicionarArquivos(e.dataTransfer.files) }}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors mb-5 ${
            dragOver ? 'border-[#8BAB3E] bg-[#8BAB3E]/5' : 'border-gray-200 bg-white hover:border-[#8BAB3E] hover:bg-[#8BAB3E]/5'
          }`}
        >
          <input ref={inputRef} type="file" accept=".pdf" multiple className="hidden" onChange={e => adicionarArquivos(e.target.files)} />
          <div className="w-12 h-12 bg-[#E87722] rounded-xl flex items-center justify-center mx-auto mb-3">
            <span className="text-white text-lg font-bold">PDF</span>
          </div>
          <p className="text-sm font-medium text-gray-700">Arraste os PDFs aqui ou clique para selecionar</p>
          <p className="text-xs text-gray-400 mt-1">Múltiplos arquivos permitidos</p>
        </div>

        {/* Lista de itens */}
        {items.length > 0 && (
          <div className="flex flex-col gap-3 mb-6">
            {/* Cabeçalho */}
            <div className="grid grid-cols-[1fr_200px_140px_160px_160px_36px] gap-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wide">
              <span>Arquivo</span>
              <span>Obra</span>
              <span>Tipo</span>
              <span>Mês</span>
              <span>Valor total</span>
              <span />
            </div>

            {items.map(item => (
              <div key={item.id} className="bg-white rounded-xl border border-gray-100 p-4 grid grid-cols-[1fr_200px_140px_160px_160px_36px] gap-3 items-center">
                {/* Nome arquivo */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-10 bg-[#E87722] rounded flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-[10px] font-bold">PDF</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{item.file.name}</p>
                    <p className="text-xs text-gray-400">{(item.file.size / 1024).toFixed(0)} KB</p>
                  </div>
                </div>

                {/* Obra */}
                <select
                  value={item.obraId}
                  onChange={e => atualizar(item.id, 'obraId', e.target.value)}
                  className={`border rounded-lg px-2 py-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#8BAB3E] ${
                    item.obraId ? 'border-gray-200' : 'border-orange-300 bg-orange-50'
                  }`}
                >
                  <option value="">Selecione a obra</option>
                  {obras.map(o => (
                    <option key={o.id} value={o.id}>{o.nome}</option>
                  ))}
                </select>

                {/* Tipo */}
                <select
                  value={item.tipo}
                  onChange={e => atualizar(item.id, 'tipo', e.target.value as TipoDS)}
                  className="border border-gray-200 rounded-lg px-2 py-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#8BAB3E]"
                >
                  {Object.keys(TIPO_CONFIG).map(t => (
                    <option key={t} value={t}>{TIPO_CONFIG[t as TipoDS].label}</option>
                  ))}
                </select>

                {/* Mês */}
                <input
                  value={item.mes}
                  onChange={e => atualizar(item.id, 'mes', e.target.value)}
                  placeholder="Ex: Junho/2026"
                  className="border border-gray-200 rounded-lg px-2 py-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#8BAB3E]"
                />

                {/* Valor */}
                <input
                  value={item.valor}
                  onChange={e => atualizar(item.id, 'valor', formatBRL(e.target.value))}
                  placeholder="R$ 0,00"
                  inputMode="numeric"
                  className={`border rounded-lg px-2 py-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#8BAB3E] ${
                    item.valor ? 'border-gray-200' : 'border-orange-300 bg-orange-50'
                  }`}
                />

                {/* Remover */}
                <button
                  onClick={() => remover(item.id)}
                  className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Barra de progresso */}
        {criando && (
          <div className="bg-white rounded-xl border border-gray-100 p-4 mb-5">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Criando DSs...</span>
              <span>{progresso}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div className="bg-[#8BAB3E] h-2 rounded-full transition-all duration-300" style={{ width: `${progresso}%` }} />
            </div>
          </div>
        )}

        {/* Rodapé */}
        {items.length > 0 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {items.length} {items.length === 1 ? 'arquivo' : 'arquivos'} · {items.filter(i => !i.obraId || !i.valor).length > 0
                ? <span className="text-orange-500">{items.filter(i => !i.obraId || !i.valor).length} pendentes de preenchimento</span>
                : <span className="text-green-600">todos prontos</span>}
            </p>
            <button
              onClick={criarTodas}
              disabled={!valido || criando}
              className="bg-[#8BAB3E] hover:bg-[#7a9a35] disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold px-6 py-3 rounded-lg text-sm transition-colors"
            >
              {criando ? `Criando... ${progresso}%` : `Criar ${items.length} DS${items.length > 1 ? 's' : ''}`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
