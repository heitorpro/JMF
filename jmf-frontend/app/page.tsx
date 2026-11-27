import { JmfAppShell } from '@/components/jmf/app-shell'
import { displayName, getCurrentUser, hasJmfManagementAccess } from '@/lib/auth/server'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/auth/sign-in')
  }

  return (
    <JmfAppShell
      userName={displayName(user)}
      userEmail={user.email ?? ''}
      canManage={hasJmfManagementAccess(user)}
    />
  )
}
