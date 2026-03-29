import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import axios from 'axios'

const getApiUrl = () => {
  const internalUrl = process.env.INTERNAL_API_URL
  const publicUrl = process.env.NEXT_PUBLIC_API_URL
  const fallbackUrl = 'http://localhost:8000'
  return internalUrl || publicUrl || fallbackUrl
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        remember: { label: 'Remember me', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        try {
          const response = await axios.post(`${getApiUrl()}/api/v1/auth/login`, {
            email: credentials.email,
            password: credentials.password
          }, { timeout: 10000 })

          const data = response.data

          if (data?.access_token) {
            return {
              id: data.user.id.toString(),
              email: data.user.email,
              name: data.user.name || data.user.email,
              accessToken: data.access_token,
              refreshToken: data.refresh_token,
              organizationId: data.user.organization_id,
              role: data.user.role,
              rememberMe: credentials.remember === 'true',
            }
          }

          return null
        } catch (error: any) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[Auth] Login failed:', error?.response?.data?.detail || error?.message)
          }
          return null
        }
      }
    })
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.accessToken = (user as any).accessToken
        token.refreshToken = (user as any).refreshToken
        token.id = user.id
        token.role = (user as any).role
        token.organizationId = (user as any).organizationId
        token.rememberMe = (user as any).rememberMe ?? true
        token.loginAt = Date.now()
        token.accessTokenExpiresAt = Date.now() + 29 * 60 * 1000
      }

      // For non-remembered sessions, hard-expire after 2 hours from login
      if (!token.rememberMe) {
        const sessionMaxMs = 2 * 60 * 60 * 1000 // 2 hours
        if (Date.now() > ((token.loginAt as number) + sessionMaxMs)) {
          return { ...token, error: 'SessionExpired' }
        }
        // Non-remembered sessions: skip refresh — let them expire naturally
        return token
      }

      // Refresh access token if it is about to expire
      if (Date.now() < (token.accessTokenExpiresAt as number ?? 0)) {
        return token
      }

      // Attempt silent refresh (remembered sessions only)
      if (token.refreshToken) {
        try {
          const response = await axios.post(`${getApiUrl()}/api/v1/auth/refresh`, {
            refresh_token: token.refreshToken,
          }, { timeout: 10000 })

          const data = response.data
          token.accessToken = data.access_token
          token.refreshToken = data.refresh_token
          token.accessTokenExpiresAt = Date.now() + 29 * 60 * 1000
        } catch {
          // Refresh failed — force re-login by clearing the token
          return { ...token, error: 'RefreshTokenExpired' }
        }
      }

      return token
    },

    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        session.user.accessToken = token.accessToken as string
        session.user.role = token.role as string
        session.user.organizationId = token.organizationId as string
        ;(session as any).error = token.error
        ;(session as any).rememberMe = token.rememberMe
      }
      return session
    },

    async redirect({ url, baseUrl }) {
      if (url.startsWith('/')) return `${baseUrl}${url}`
      if (new URL(url).origin === baseUrl) return url
      return `${baseUrl}/dashboard`
    }
  },

  pages: {
    signIn: '/auth/login',
    signOut: '/auth/logout',
    error: '/auth/error',
    newUser: '/auth/welcome'
  },

  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7 days — the JWT check above enforces 2h for non-remembered sessions
  },

  secret: process.env.NEXTAUTH_SECRET,

  debug: false,
}
