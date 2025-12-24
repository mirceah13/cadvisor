import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import AppleProvider from 'next-auth/providers/apple'
import MicrosoftProvider from 'next-auth/providers/microsoft'
import axios from 'axios'

// Use internal API URL for server-side calls in Docker, fallback to public URL
const API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export const authOptions: NextAuthOptions = {
  providers: [
    // Email/Password Provider
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password required')
        }

        try {
          // Call backend API to authenticate
          const response = await axios.post(`${API_URL}/api/v1/auth/login`, {
            email: credentials.email,
            password: credentials.password
          })

          const user = response.data

          if (user && user.access_token) {
            return {
              id: user.user.id.toString(),
              email: user.user.email,
              name: user.user.full_name || user.user.email,
              accessToken: user.access_token,
              organizationId: user.user.organization_id,
              role: user.user.role
            }
          }

          return null
        } catch (error: any) {
          console.error('Auth error:', error.response?.data || error.message)
          throw new Error(error.response?.data?.detail || 'Authentication failed')
        }
      }
    }),

    // Google OAuth Provider
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code'
        }
      }
    }),

    // Apple OAuth Provider
    AppleProvider({
      clientId: process.env.APPLE_CLIENT_ID || '',
      clientSecret: process.env.APPLE_CLIENT_SECRET || ''
    }),

    // Microsoft OAuth Provider
    MicrosoftProvider({
      clientId: process.env.MICROSOFT_CLIENT_ID || '',
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET || '',
      authorization: {
        params: {
          scope: 'openid profile email User.Read'
        }
      }
    })
  ],

  callbacks: {
    async jwt({ token, user, account }) {
      // Initial sign in
      if (user) {
        token.accessToken = (user as any).accessToken
        token.id = user.id
        token.role = (user as any).role
        token.organizationId = (user as any).organizationId
      }

      // OAuth sign in - exchange OAuth token for backend token
      if (account && account.provider !== 'credentials') {
        try {
          const response = await axios.post(`${API_URL}/api/v1/auth/oauth/${account.provider}`, {
            access_token: account.access_token,
            id_token: account.id_token,
            provider: account.provider
          })

          token.accessToken = response.data.access_token
          token.id = response.data.user.id.toString()
          token.role = response.data.user.role
          token.organizationId = response.data.user.organization_id
        } catch (error) {
          console.error('OAuth token exchange failed:', error)
        }
      }

      return token
    },

    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        session.user.accessToken = token.accessToken as string
        session.user.role = token.role as string
        session.user.organizationId = token.organizationId as number
      }
      return session
    },

    async redirect({ url, baseUrl }) {
      // Redirect to dashboard after successful login
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
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  secret: process.env.NEXTAUTH_SECRET,

  debug: process.env.NODE_ENV === 'development'
}
