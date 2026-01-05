import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'
import { ThemeProvider } from '@/components/theme-provider'
import { AuthProvider } from '@/components/providers/auth-provider'
import { LoadingBar } from '@/components/loading-bar'
import { GlobalLoadingSpinner } from '@/components/global-loading-spinner'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'CADVisor',
  description: 'Building submission validation and compliance checking platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <AuthProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <LoadingBar />
            <GlobalLoadingSpinner />
            {children}
            <Toaster />
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
