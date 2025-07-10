import { useEffect } from 'react'

export function useAutoScroll(dep: any, elementId = 'chat-scroll') {
  useEffect(() => {
    const el = document.getElementById(elementId)
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  }, [dep, elementId])
}
