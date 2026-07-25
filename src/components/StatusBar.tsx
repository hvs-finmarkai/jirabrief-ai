import { motion } from 'framer-motion'
import { Wifi, WifiOff, Sparkles } from 'lucide-react'
import type { ConnectionStatus } from '../types'

interface StatusBarProps {
  connectionStatus: ConnectionStatus
  isDemoMode: boolean
  onDisconnect: () => void
}

export function StatusBar({ connectionStatus, isDemoMode, onDisconnect }: StatusBarProps) {
  if (connectionStatus === 'disconnected') return null

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center justify-between px-4 py-2 bg-white border-b border-warm-100"
    >
      <div className="flex items-center gap-2">
        {connectionStatus === 'connected' ? (
          <Wifi className="w-3.5 h-3.5 text-status-done" />
        ) : (
          <WifiOff className="w-3.5 h-3.5 text-status-blocked" />
        )}
        <span className="text-xs text-warm-500">
          {connectionStatus === 'connected' && !isDemoMode && 'Connected to Jira'}
          {connectionStatus === 'connected' && isDemoMode && (
            <span className="flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-accent" />
              Demo Mode
            </span>
          )}
          {connectionStatus === 'error' && 'Connection failed'}
        </span>
      </div>
      <button
        onClick={onDisconnect}
        className="text-xs text-warm-400 hover:text-charcoal transition-colors cursor-pointer"
      >
        Disconnect
      </button>
    </motion.div>
  )
}
