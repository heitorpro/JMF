import { createNeonAuth } from '@neondatabase/auth/next/server'

const baseUrl = process.env.NEON_AUTH_BASE_URL
const cookieSecret = process.env.NEON_AUTH_COOKIE_SECRET

if (!baseUrl) {
  throw new Error('NEON_AUTH_BASE_URL is required to initialize Neon Auth.')
}

if (!cookieSecret || cookieSecret.length < 32) {
  throw new Error('NEON_AUTH_COOKIE_SECRET must contain at least 32 characters.')
}

export const auth = createNeonAuth({
  baseUrl,
  cookies: {
    secret: cookieSecret,
    sameSite: process.env.NODE_ENV === 'development' ? 'none' : 'lax',
  },
})

export function hasJmfManagementAccess(user: {
  role?: string | string[]
}) {
  const roles = Array.isArray(user.role) ? user.role : [user.role]
  return roles.includes('admin')
}

