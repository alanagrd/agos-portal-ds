import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const isCliente = user?.app_metadata?.perfil === 'cliente'
  const path = request.nextUrl.pathname

  // Rotas AGOS: redireciona não-autenticados para login, clientes para área deles
  if (
    path.startsWith('/dashboard') ||
    path.startsWith('/ds') ||
    path.startsWith('/obras')
  ) {
    if (!user) return NextResponse.redirect(new URL('/auth/login', request.url))
    if (isCliente) return NextResponse.redirect(new URL('/cliente', request.url))
  }

  // Rotas CLIENTE (exceto login e criação de conta): redireciona conforme perfil
  if (
    path.startsWith('/cliente') &&
    !path.startsWith('/cliente/entrar') &&
    !path.startsWith('/cliente/criar-conta')
  ) {
    if (!user) return NextResponse.redirect(new URL('/cliente/entrar', request.url))
    if (!isCliente) return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: ['/dashboard/:path*', '/ds/:path*', '/obras/:path*', '/cliente/:path*'],
}
