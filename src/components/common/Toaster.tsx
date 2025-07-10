import { Toaster as SonnerToaster } from 'sonner'
import { type ComponentProps } from 'react'

/** Props for {@link Toaster}. */
export interface ToasterProps extends ComponentProps<typeof SonnerToaster> {}

/**
 * Application level toast provider using Sonner.
 */
export function Toaster(props: ToasterProps = {}) {
  return <SonnerToaster position="top-center" richColors {...props} />
}

