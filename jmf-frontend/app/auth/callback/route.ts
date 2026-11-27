import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * Retorno dos links enviados por e-mail (confirmação de cadastro e redefinição de senha):
 * troca o código pela sessão e segue para a página indicada em "next".
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const nextParam = searchParams.get('next') ?? '/'
  const next = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/'

  if (code) {
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }
  const fallback = next === '/auth/reset-password' ? '/auth/reset-password?error=link' : '/auth/sign-in?link=invalido'
  return NextResponse.redirect(`${origin}${fallback}`)
}
