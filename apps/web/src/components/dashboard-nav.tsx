'use client'

import { LoadingLink } from '@/components/loading-link'
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
    <div className="border-b">
      <div className="flex h-16 items-center px-4 container">
        <LoadingLink href="/dashboard" className="flex items-center space-x-2 mr-6">
          <span className="font-bold text-xl">CADVisor</span>
        </LoadingLink>
        <nav className="flex items-center space-x-4 lg:space-x-6 flex-1">
          {navigation.map((item) => {
            const Icon = item.icon
            return (
              <LoadingLink
                key={item.name}
                href={item.href}
                className={cn(
                  'text-sm font-medium transition-colors hover:text-primary flex items-center gap-2',
                  pathname === item.href
                    ? 'text-foreground'
                    : 'text-muted-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                {item.name}
              </LoadingLink>
            )
          })}
        </nav>
        <div className="ml-auto flex items-center space-x-4">
          <ThemeToggle />
          <LoadingLink href="/profile">
            <Button variant="ghost" size="sm" className="gap-2">
              <User className="h-4 w-4" />
              {user?.name || user?.email}
            </Button>
          </LoadingLink>
          <Button variant="ghost" size="sm" onClick={() => signOut()} className="gap-2">
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>
    </div>
  )
}
