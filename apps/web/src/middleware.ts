export { default } from 'next-auth/middleware'

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/projects/:path*',
    '/submissions/:path*',
    '/knowledge-base/:path*',
    '/reports/:path*',
    '/settings/:path*',
    '/api/:path*'
  ]
}
