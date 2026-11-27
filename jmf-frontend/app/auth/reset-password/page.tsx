import type { Metadata } from 'next'
import { ResetPasswordForm } from '@/components/auth/password-reset'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Nova senha',
  robots: { index: false, follow: false },
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  return <ResetPasswordForm linkError={error} />
}
