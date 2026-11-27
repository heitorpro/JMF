import type { Metadata } from 'next'
import { ForgotPasswordForm } from '@/components/auth/password-reset'

export const metadata: Metadata = {
  title: 'Esqueci minha senha',
  robots: { index: false, follow: false },
}

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />
}
