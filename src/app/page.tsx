export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function Home() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      redirect('/dashboard')
    } else {
      redirect('/auth/login')
    }
  } catch (err: unknown) {
    // Erros de redirect são normais no Next.js — re-lança
    if (err && typeof err === 'object' && 'digest' in err) throw err
    console.error('[page.tsx] Erro ao inicializar Supabase:', err)
    redirect('/auth/login')
  }
}
