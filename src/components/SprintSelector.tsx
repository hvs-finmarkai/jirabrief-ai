import { motion } from 'framer-motion'
import { Calendar, ChevronRight, ArrowLeft } from 'lucide-react'
import type { JiraSprint } from '../types'

interface SprintSelectorProps {
  sprints: JiraSprint[]
  projectName: string
  onSelect: (sprint: JiraSprint) => void
  onBack: () => void
}

function sprintStateLabel(state: string): { label: string; className: string } {
  switch (state) {
    case 'active':
      return { label: 'Active', className: 'bg-status-done/10 text-status-done' }
    case 'closed':
      return { label: 'Closed', className: 'bg-warm-200 text-warm-600' }
    default:
      return { label: 'Future', className: 'bg-status-progress/10 text-status-progress' }
  }
}

export function SprintSelector({ sprints, projectName, onSelect, onBack }: SprintSelectorProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="w-full max-w-lg mx-auto"
    >
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-warm-500 hover:text-charcoal mb-4 transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to projects
      </button>

      <h2 className="text-xl font-semibold text-charcoal mb-1">Select Sprint</h2>
      <p className="text-sm text-warm-500 mb-6">{projectName}</p>

      {sprints.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-warm-200">
          <Calendar className="w-8 h-8 text-warm-300 mx-auto mb-3" />
          <p className="text-sm text-warm-500">No sprints found for this project</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sprints.map((sprint, index) => {
            const state = sprintStateLabel(sprint.state)
            return (
              <motion.button
                key={sprint.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => onSelect(sprint)}
                className="w-full flex items-center gap-4 p-4 bg-white rounded-xl border border-warm-200 hover:border-accent/30 hover:shadow-sm transition-all group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-lg bg-warm-100 flex items-center justify-center group-hover:bg-accent/10 transition-colors">
                  <Calendar className="w-5 h-5 text-warm-500 group-hover:text-accent transition-colors" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-charcoal">{sprint.name}</p>
                  <p className="text-xs text-warm-400">
                    {sprint.startDate && sprint.endDate
                      ? `${new Date(sprint.startDate).toLocaleDateString()} — ${new Date(sprint.endDate).toLocaleDateString()}`
                      : 'No dates set'}
                  </p>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${state.className}`}>
                  {state.label}
                </span>
                <ChevronRight className="w-4 h-4 text-warm-300 group-hover:text-accent transition-colors" />
              </motion.button>
            )
          })}
        </div>
      )}
    </motion.div>
  )
}
