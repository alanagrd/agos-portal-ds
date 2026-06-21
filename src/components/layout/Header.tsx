'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function Header() {
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <header className="bg-[#1C1C1E] h-14 px-6 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 bg-[#8BAB3E] rounded-md flex items-center justify-center">
          <span className="text-white text-sm font-bold">A</span>
        </div>
        <span className="text-white font-semibold text-sm">AGOS</span>
        <span className="text-gray-500 text-sm">/ Portal DS</span>
      </div>

      <nav className="flex items-center gap-6">
        <Link href="/dashboard" className="text-gray-400 hover:text-white text-sm transition-colors">
          Dashboard
        </Link>
        <Link href="/obras" className="text-gray-400 hover:text-white text-sm transition-colors">
          Obras
        </Link>
        <button
          onClick={handleLogout}
          className="text-gray-400 hover:text-white text-sm transition-colors"
        >
          Sair
        </button>
      </nav>
    </header>
  )
}
