'use client'

import { LoadingLink } from '@/components/loading-link'
import { Logo } from '@/components/logo'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'
import { useAuth } from '@/hooks/use-auth'
import {
  LayoutDashboard,
  FolderOpen,
  Upload,
  BookOpen,
  FileText,
  CreditCard,
  Settings,
  LogOut,
  User,
} from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Projects', href: '/projects', icon: FolderOpen },
  { name: 'Submissions', href: '/submissions', icon: Upload },
  { name: 'Knowledge Base', href: '/knowledge-base', icon: BookOpen },
  { name: 'Reports', href: '/reports', icon: FileText },
  { name: 'Billing', href: '/billing', icon: CreditCard },
]

export function DashboardNav() {
  const pathname = usePathname()
  const { user, signOut } = useAuth()

  return (
    <div className="border-b bg-background/95 backdrop-blur-sm sticky top-0 z-40 shadow-sm">
      <div className="flex h-16 items-center px-4 container">
        <LoadingLink href="/dashboard" className="flex items-center mr-8">
          <Logo width={32} height={32} showText={true} />
        </LoadingLink>
        <nav className="flex items-center gap-1 flex-1">
          {navigation.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <LoadingLink
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                <Icon className="h-4 w-4" />
                {item.name}
              </LoadingLink>
            )
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <LoadingLink href="/profile">
            <Button variant="ghost" size="sm" className="gap-2 rounded-full">
              <User className="h-4 w-4" />
              {user?.name || user?.email}
            </Button>
          </LoadingLink>
          <Button variant="ghost" size="sm" onClick={() => signOut()} className="gap-2 rounded-full">
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>
    </div>
  )
}
