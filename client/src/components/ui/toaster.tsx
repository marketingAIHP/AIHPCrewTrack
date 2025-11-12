import { useEffect } from "react"
import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts, dismiss } = useToast()

  // Add click-outside-to-close functionality
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Only dismiss toasts if there are any open
      const openToasts = toasts.filter(t => t.open)
      if (openToasts.length === 0) return

      const target = event.target as HTMLElement
      
      // Check if the click is on a toast element itself
      // Radix UI Toast adds data-state attribute to toast root elements
      // We check if the clicked element or any parent has data-state="open" (active toast)
      const clickedOnToast = target.closest('[data-state="open"]')
      
      // If click is not on an active toast element, dismiss all toasts
      // This allows dismissing by clicking anywhere on the screen except the toast itself
      if (!clickedOnToast) {
        // Dismiss all open toasts when clicking outside
        openToasts.forEach(toast => {
          dismiss(toast.id)
        })
      }
    }

    // Add event listener when there are open toasts
    const openToasts = toasts.filter(t => t.open)
    if (openToasts.length > 0) {
      // Use a small delay to avoid dismissing immediately when toast appears
      const timeoutId = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside)
      }, 100)
      
      return () => {
        clearTimeout(timeoutId)
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [toasts, dismiss])

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
