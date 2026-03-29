'use client'

import { LoadingLink } from '@/components/loading-link'
import { Logo } from '@/components/logo'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'
import { useAuth } from '@/hooks/use-auth'
import {
  LogOut,
  User,
} from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/dashboard' },
  { name: 'Projects', href: '/projects' },
  { name: 'Submissions', href: '/submissions' },
  { name: 'Knowledge Base', href: '/knowledge-base' },
  { name: 'Reports', href: '/reports' },
  { name: 'Billing', href: '/billing' },
]

export function DashboardNav() {
  const pathname = usePathname()
  const { user, signOut } = useAuth()

  return (
    <div className="border-b border-border bg-background sticky top-0 z-40">
      <div className="flex h-14 items-center px-6 container max-w-7xl">
        <LoadingLink href="/dashboard" className="flex items-center mr-10">
          <Logo width={28} height={28} showText={true} />
        </LoadingLink>
        <nav className="flex items-center gap-0 flex-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <LoadingLink
                key={item.name}
                href={item.href}
                className={cn(
                  'px-3 py-1 text-sm transition-colors',
                  isActive
                    ? 'text-primary font-semibold'
                    : 'text-muted-foreground hover:text-foreground font-medium'
                )}
              >
                {item.name}
              </LoadingLink>
            )
          })}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          <LoadingLink href="/profile">
            <Button variant="ghost" size="sm" className="gap-2 text-sm font-medium">
              <User className="h-4 w-4" />
              {user?.name || user?.email}
            </Button>
          </LoadingLink>
          <Button variant="ghost" size="sm" onClick={() => signOut()} className="gap-2 text-sm text-muted-foreground hover:text-foreground">
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </div>
    </div>
  )
}
