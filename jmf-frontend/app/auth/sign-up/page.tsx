import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AuthForm } from '@/components/auth/auth-form'
import { getCurrentUser } from '@/lib/auth/server'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Criar conta',
  robots: { index: false, follow: false },
}

export default async function SignUpPage() {
  const user = await getCurrentUser()

  if (user) {
    redirect('/')
  }

  return <AuthForm mode="sign-up" />
}
