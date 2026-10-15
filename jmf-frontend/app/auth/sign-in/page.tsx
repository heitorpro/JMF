import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AuthForm } from '@/components/auth/auth-form'
import { auth } from '@/lib/auth/server'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Entrar',
  robots: { index: false, follow: false },
}

export default async function SignInPage() {
  const { data: session } = await auth.getSession()

  if (session?.user) {
    redirect('/')
  }

  return <AuthForm mode="sign-in" />
}
