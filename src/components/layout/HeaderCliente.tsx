'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function HeaderCliente() {
  const [nome, setNome] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setNome(user?.user_metadata?.nome ?? user?.email ?? '')
    })
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/cliente/entrar')
  }

  return (
    <header className="bg-[#1C1C1E] h-14 px-6 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 bg-[#8BAB3E] rounded-md flex items-center justify-center">
          <span className="text-white text-sm font-bold">A</span>
        </div>
        <span className="text-white font-semibold text-sm">AGOS</span>
        <span className="text-gray-500 text-sm">/ Portal do Cliente</span>
      </div>
      <div className="flex items-center gap-4">
        {nome && <span className="text-gray-400 text-sm truncate max-w-[200px]">{nome}</span>}
        <button
          onClick={handleLogout}
          className="text-gray-400 hover:text-white text-sm transition-colors"
        >
          Sair
        </button>
      </div>
    </header>
  )
}
