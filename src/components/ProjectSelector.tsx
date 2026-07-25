import { motion } from 'framer-motion'
import { Folder, ChevronRight } from 'lucide-react'
import type { JiraProject } from '../types'

interface ProjectSelectorProps {
  projects: JiraProject[]
  onSelect: (project: JiraProject) => void
}

export function ProjectSelector({ projects, onSelect }: ProjectSelectorProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="w-full max-w-lg mx-auto"
    >
      <h2 className="text-xl font-semibold text-charcoal mb-1">Select Project</h2>
      <p className="text-sm text-warm-500 mb-6">Choose a project to generate reports for</p>

      <div className="space-y-2">
        {projects.map((project, index) => (
          <motion.button
            key={project.key}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => onSelect(project)}
            className="w-full flex items-center gap-4 p-4 bg-white rounded-xl border border-warm-200 hover:border-accent/30 hover:shadow-sm transition-all group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-lg bg-warm-100 flex items-center justify-center group-hover:bg-accent/10 transition-colors">
              <Folder className="w-5 h-5 text-warm-500 group-hover:text-accent transition-colors" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-charcoal">{project.name}</p>
              <p className="text-xs text-warm-400">{project.key} · Lead: {project.lead}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-warm-300 group-hover:text-accent transition-colors" />
          </motion.button>
        ))}
      </div>
    </motion.div>
  )
}
