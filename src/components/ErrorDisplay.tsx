import { motion } from 'framer-motion'
import { AlertCircle, RefreshCw } from 'lucide-react'

interface ErrorDisplayProps {
  message: string
  onRetry?: () => void
}

export function ErrorDisplay({ message, onRetry }: ErrorDisplayProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full max-w-md mx-auto text-center py-12"
    >
      <div className="w-12 h-12 rounded-full bg-status-blocked/10 flex items-center justify-center mx-auto mb-4">
        <AlertCircle className="w-6 h-6 text-status-blocked" />
      </div>
      <p className="text-sm text-charcoal-light mb-4">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm text-warm-600 bg-white border border-warm-200 rounded-lg hover:border-warm-300 transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Try again
        </button>
      )}
    </motion.div>
  )
}
