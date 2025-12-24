import 'next-auth'
import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      accessToken: string
      role: string
      organizationId: number
    } & DefaultSession['user']
  }

  interface User {
    id: string
    accessToken?: string
    role?: string
    organizationId?: number
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    accessToken: string
    role: string
    organizationId: number
  }
}
