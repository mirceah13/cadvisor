'use client'

import { useSession, signOut as nextAuthSignOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export function useAuth() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const isLoading = status === 'loading'
  const isAuthenticated = status === 'authenticated'
  const user = session?.user

  const signOut = async () => {
    await nextAuthSignOut({ redirect: false })
    router.push('/auth/login')
  }

  return {
    user,
    isLoading,
    isAuthenticated,
    signOut,
    accessToken: user?.accessToken,
    organizationId: user?.organizationId,
    role: user?.role
  }
}
