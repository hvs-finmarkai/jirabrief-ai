import { motion } from 'framer-motion'

interface LoadingSpinnerProps {
  message?: string
}

export function LoadingSpinner({ message = 'Loading...' }: LoadingSpinnerProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center py-16"
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
        className="w-8 h-8 border-2 border-warm-200 border-t-accent rounded-full mb-4"
      />
      <p className="text-sm text-warm-500">{message}</p>
    </motion.div>
  )
}
