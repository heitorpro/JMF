import { JmfAppShell } from '@/components/jmf/app-shell'
import { auth, hasJmfManagementAccess } from '@/lib/auth/server'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const { data: session } = await auth.getSession()

  if (!session?.user) {
    redirect('/auth/sign-in')
  }

  const user = session.user as typeof session.user & { role?: string | string[] }

  return (
    <JmfAppShell
      userName={session.user.name}
      userEmail={session.user.email}
      canManage={hasJmfManagementAccess(user)}
    />
  )
}
