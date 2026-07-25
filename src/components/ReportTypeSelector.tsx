import { motion } from 'framer-motion'
import { FileText, BarChart3, Briefcase, Tag, ArrowLeft, Zap } from 'lucide-react'
import type { ReportType } from '../types'

interface ReportTypeSelectorProps {
  projectName: string
  sprintName: string
  selectedType: ReportType | null
  onSelect: (type: ReportType) => void
  onGenerate: () => void
  onBack: () => void
  isGenerating: boolean
}

const reportTypes: { type: ReportType; label: string; description: string; icon: typeof FileText }[] = [
  {
    type: 'sprint-summary',
    label: 'Sprint Summary',
    description: 'Completed, in progress, blockers, and next work',
    icon: FileText,
  },
  {
    type: 'status-report',
    label: 'Status Report',
    description: 'Current state, progress, risks, and actions',
    icon: BarChart3,
  },
  {
    type: 'executive-digest',
    label: 'Executive Digest',
    description: 'Non-technical overview for leadership',
    icon: Briefcase,
  },
  {
    type: 'release-notes',
    label: 'Release Notes',
    description: 'New features, improvements, and fixes',
    icon: Tag,
  },
]

export function ReportTypeSelector({
  projectName,
  sprintName,
  selectedType,
  onSelect,
  onGenerate,
  onBack,
  isGenerating,
}: ReportTypeSelectorProps) {
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
        Back to sprints
      </button>

      <h2 className="text-xl font-semibold text-charcoal mb-1">Generate Report</h2>
      <p className="text-sm text-warm-500 mb-6">
        {projectName} · {sprintName}
      </p>

      <div className="grid grid-cols-2 gap-3 mb-6">
        {reportTypes.map((rt, index) => {
          const Icon = rt.icon
          const isSelected = selectedType === rt.type
          return (
            <motion.button
              key={rt.type}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => onSelect(rt.type)}
              className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                isSelected
                  ? 'border-accent bg-accent/5 shadow-sm'
                  : 'border-warm-200 bg-white hover:border-warm-300'
              }`}
            >
              <Icon
                className={`w-5 h-5 mb-2 ${isSelected ? 'text-accent' : 'text-warm-400'}`}
              />
              <p className={`text-sm font-medium ${isSelected ? 'text-accent' : 'text-charcoal'}`}>
                {rt.label}
              </p>
              <p className="text-xs text-warm-400 mt-0.5">{rt.description}</p>
            </motion.button>
          )
        })}
      </div>

      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={onGenerate}
        disabled={!selectedType || isGenerating}
        className="w-full flex items-center justify-center gap-2 py-3 bg-charcoal text-white rounded-xl text-sm font-medium hover:bg-charcoal-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
      >
        {isGenerating ? (
          <>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
              className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
            />
            Generating...
          </>
        ) : (
          <>
            <Zap className="w-4 h-4" />
            Generate Report
          </>
        )}
      </motion.button>
    </motion.div>
  )
}
