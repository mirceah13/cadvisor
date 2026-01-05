'use client'

import Link, { LinkProps } from 'next/link'
import { useRouter } from 'next/navigation'
import { AnchorHTMLAttributes, MouseEvent, ReactNode } from 'react'
import { triggerLoading } from './global-loading-spinner'

interface LoadingLinkProps extends LinkProps {
  children: ReactNode
  className?: string
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void
}

export function LoadingLink({ children, onClick, ...props }: LoadingLinkProps) {
  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    triggerLoading()
    if (onClick) {
      onClick(e)
    }
  }

  return (
    <Link {...props} onClick={handleClick}>
      {children}
    </Link>
  )
}
