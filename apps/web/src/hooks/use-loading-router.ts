'use client'

import { useRouter as useNextRouter } from 'next/navigation'
import { triggerLoading } from '@/components/global-loading-spinner'

export function useLoadingRouter() {
  const router = useNextRouter()

  return {
    push: (href: string, options?: any) => {
      triggerLoading()
      router.push(href, options)
    },
    replace: (href: string, options?: any) => {
      triggerLoading()
      router.replace(href, options)
    },
    back: () => {
      triggerLoading()
      router.back()
    },
    forward: () => {
      triggerLoading()
      router.forward()
    },
    refresh: () => {
      triggerLoading()
      router.refresh()
    },
    prefetch: router.prefetch,
  }
}
