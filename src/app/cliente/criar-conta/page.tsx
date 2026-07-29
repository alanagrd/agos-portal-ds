'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Etapa = 1 | 2 | 3

export default function CriarContaPage() {
  const [etapa, setEtapa] = useState<Etapa>(1)
  const [email, setEmail] = useState('')
  const [codigo, setCodigo] = useState('')
  const [nome, setNome] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const solicitarCodigo = async () => {
    setLoading(true)
    setErro('')
    const res = await fetch('/api/cliente/solicitar-codigo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    setLoading(false)
    if (res.status === 403) {
      setErro('Este e-mail não está cadastrado em nenhuma obra. Fale com seu contato na AGOS.')
      return
    }
    if (res.status === 409) {
      setErro('Você já tem conta. Faça login.')
      return
    }
    if (res.status === 429) {
      setErro('Muitas tentativas. Aguarde alguns minutos.')
      return
    }
    if (!res.ok) {
      setErro('Erro ao enviar código. Tente novamente.')
      return
    }
    setEtapa(2)
  }

  const avancarParaEtapa3 = () => {
    if (codigo.length === 6) setEtapa(3)
  }

  const registrar = async () => {
    if (senha !== confirmarSenha) { setErro('As senhas não coincidem.'); return }
    if (senha.length < 8) { setErro('A senha deve ter pelo menos 8 caracteres.'); return }
    setLoading(true)
    setErro('')
    const res = await fetch('/api/cliente/registrar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, codigo, nome, senha }),
    })
    setLoading(false)
    if (res.status === 400) {
      setErro('Código inválido ou expirado.')
      setEtapa(2)
      return
    }
    if (res.status === 409) {
      setErro('Você já tem conta. Faça login.')
      return
    }
    if (!res.ok) {
      setErro('Erro ao criar conta. Tente novamente.')
      return
    }
    // Login automático após criação
    const { error: loginError } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (!loginError) router.push('/cliente')
  }

  return (
    <div className="min-h-screen bg-[#F8F9FB] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-[#8BAB3E] rounded-xl mb-4">
            <span className="text-white font-bold text-xl">A</span>
          </div>
          <h1 className="text-xl font-bold text-[#1C1C1E]">AGOS Serviços</h1>
          <p className="text-sm text-gray-500 mt-1">Criar conta — Portal do Cliente</p>
          {/* Indicador de etapa */}
          <div className="flex items-center justify-center gap-2 mt-4">
            {([1, 2, 3] as Etapa[]).map(n => (
              <div
                key={n}
                className={`w-2 h-2 rounded-full transition-colors ${n === etapa ? 'bg-[#8BAB3E]' : n < etapa ? 'bg-[#8BAB3E]/40' : 'bg-gray-200'}`}
              />
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">

          {/* Etapa 1: E-mail */}
          {etapa === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">E-mail cadastrado na obra</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  onKeyDown={e => e.key === 'Enter' && solicitarCodigo()}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#8BAB3E] focus:border-transparent"
                />
              </div>
              {erro && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{erro}</p>}
              <button
                onClick={solicitarCodigo}
                disabled={loading || !email}
                className="w-full bg-[#8BAB3E] hover:bg-[#7a9a35] disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors"
              >
                {loading ? 'Verificando...' : 'Continuar'}
              </button>
            </div>
          )}

          {/* Etapa 2: Código */}
          {etapa === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Enviamos um código para <strong>{email}</strong>. Ele vale por 15 minutos.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Código de 6 dígitos</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={codigo}
                  onChange={e => setCodigo(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 text-center tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-[#8BAB3E] focus:border-transparent"
                />
              </div>
              {erro && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{erro}</p>}
              <button
                onClick={avancarParaEtapa3}
                disabled={codigo.length !== 6}
                className="w-full bg-[#8BAB3E] hover:bg-[#7a9a35] disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors"
              >
                Continuar
              </button>
              <p className="text-center text-xs text-gray-400">
                Não recebeu?{' '}
                <button
                  onClick={() => { setEtapa(1); setCodigo(''); setErro('') }}
                  className="text-[#8BAB3E] hover:underline"
                >
                  Reenviar código
                </button>
              </p>
            </div>
          )}

          {/* Etapa 3: Nome e senha */}
          {etapa === 3 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Seu nome</label>
                <input
                  type="text"
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  placeholder="Nome completo"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#8BAB3E] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Senha</label>
                <input
                  type="password"
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#8BAB3E] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirmar senha</label>
                <input
                  type="password"
                  value={confirmarSenha}
                  onChange={e => setConfirmarSenha(e.target.value)}
                  placeholder="••••••••"
                  onKeyDown={e => e.key === 'Enter' && registrar()}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#8BAB3E] focus:border-transparent"
                />
              </div>
              {erro && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{erro}</p>}
              <button
                onClick={registrar}
                disabled={loading || !nome || !senha || !confirmarSenha}
                className="w-full bg-[#8BAB3E] hover:bg-[#7a9a35] disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors"
              >
                {loading ? 'Criando conta...' : 'Criar conta'}
              </button>
            </div>
          )}

          <p className="text-center text-xs text-gray-400 mt-6">
            Já tem conta?{' '}
            <Link href="/cliente/entrar" className="text-[#8BAB3E] hover:underline font-medium">
              Fazer login
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
