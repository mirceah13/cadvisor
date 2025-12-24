import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import axios from 'axios'

// Use internal API URL for server-side calls in Docker, fallback to public URL
// This MUST be a function, not a constant, to read env vars at runtime
const getApiUrl = () => {
  const internalUrl = process.env.INTERNAL_API_URL
  const publicUrl = process.env.NEXT_PUBLIC_API_URL
  const fallbackUrl = 'http://localhost:8000'
  
  // Prefer internal URL for server-side calls within Docker
  const apiUrl = internalUrl || publicUrl || fallbackUrl
  
  // Log for debugging (only in development)
  if (process.env.NODE_ENV === 'development') {
    console.log('[Auth] API URL Configuration:', {
      internal: internalUrl,
      public: publicUrl,
      using: apiUrl,
      env: process.env.NODE_ENV
    })
  }
  
  return apiUrl
}

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
          return null
        }

        try {
          // Call backend API to authenticate - get URL dynamically
          const apiUrl = getApiUrl()
          
          console.log('[Auth] Attempting login with API URL:', apiUrl)
          
          const response = await axios.post(`${apiUrl}/api/v1/auth/login`, {
            email: credentials.email,
            password: credentials.password
          }, {
            timeout: 10000 // 10 second timeout
          })

          console.log('[Auth] Login successful for:', credentials.email)

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
          // Log detailed error for debugging
          console.error('[Auth] Login error:', {
            message: error.message,
            code: error.code,
            response: error.response?.data,
            status: error.response?.status,
            url: error.config?.url
          })
          
          // Return null instead of throwing to prevent redirect to error page
          // The error will be handled by the client-side form
          return null
        }
      }
    })

    // OAuth Providers (disabled - uncomment and configure when needed)
    // To enable OAuth, install the providers and set environment variables:
    // npm install next-auth
    // Then uncomment the providers below and set GOOGLE_CLIENT_ID, APPLE_CLIENT_ID, etc.
    
    // GoogleProvider({
    //   clientId: process.env.GOOGLE_CLIENT_ID || '',
    //   clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    // }),
    
    // AppleProvider({
    //   clientId: process.env.APPLE_CLIENT_ID || '',
    //   clientSecret: process.env.APPLE_CLIENT_SECRET || ''
    // }),
    
    // For Microsoft/Azure AD, use:
    // import AzureADProvider from 'next-auth/providers/azure-ad'
    // AzureADProvider({
    //   clientId: process.env.AZURE_AD_CLIENT_ID || '',
    //   clientSecret: process.env.AZURE_AD_CLIENT_SECRET || '',
    //   tenantId: process.env.AZURE_AD_TENANT_ID || ''
    // })
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
          const apiUrl = getApiUrl()
          const response = await axios.post(`${apiUrl}/api/v1/auth/oauth/${account.provider}`, {
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
