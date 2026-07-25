import { useState, useCallback } from 'react'
import { AnimatePresence } from 'framer-motion'
import { ConnectionForm } from './components/ConnectionForm'
import { ProjectSelector } from './components/ProjectSelector'
import { SprintSelector } from './components/SprintSelector'
import { ReportTypeSelector } from './components/ReportTypeSelector'
import { ReportViewer } from './components/ReportViewer'
import { StatusBar } from './components/StatusBar'
import { LoadingSpinner } from './components/LoadingSpinner'
import { ErrorDisplay } from './components/ErrorDisplay'
import { api } from './services/api'
import type {
  JiraCredentials,
  JiraProject,
  JiraSprint,
  ReportType,
  ReportData,
  ConnectionStatus,
} from './types'

type Step = 'connect' | 'projects' | 'sprints' | 'report-type' | 'report'

export default function App() {
  const [step, setStep] = useState<Step>('connect')
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected')
  const [isDemoMode, setIsDemoMode] = useState(false)
  const [projects, setProjects] = useState<JiraProject[]>([])
  const [selectedProject, setSelectedProject] = useState<JiraProject | null>(null)
  const [sprints, setSprints] = useState<JiraSprint[]>([])
  const [selectedSprint, setSelectedSprint] = useState<JiraSprint | null>(null)
  const [selectedReportType, setSelectedReportType] = useState<ReportType | null>(null)
  const [report, setReport] = useState<ReportData | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConnect = useCallback(async (credentials: JiraCredentials) => {
    setConnectionStatus('connecting')
    setError(null)
    try {
      await api.connectJira(credentials)
      setConnectionStatus('connected')
      setIsDemoMode(false)
      await loadProjects()
    } catch (err) {
      setConnectionStatus('error')
      setError(err instanceof Error ? err.message : 'Failed to connect to Jira')
    }
  }, [])

  const handleDemoMode = useCallback(async () => {
    setConnectionStatus('connecting')
    setError(null)
    try {
      await api.connectDemo()
      setConnectionStatus('connected')
      setIsDemoMode(true)
      await loadProjects()
    } catch (err) {
      setConnectionStatus('error')
      setError(err instanceof Error ? err.message : 'Failed to start demo mode')
    }
  }, [])

  async function loadProjects() {
    setIsLoading(true)
    try {
      const data = await api.getProjects()
      setProjects(data)
      setStep('projects')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSelectProject(project: JiraProject) {
    setSelectedProject(project)
    setIsLoading(true)
    setError(null)
    try {
      const data = await api.getSprints(project.key)
      setSprints(data)
      setStep('sprints')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sprints')
    } finally {
      setIsLoading(false)
    }
  }

  function handleSelectSprint(sprint: JiraSprint) {
    setSelectedSprint(sprint)
    setSelectedReportType(null)
    setStep('report-type')
  }

  async function handleGenerate() {
    if (!selectedProject || !selectedSprint || !selectedReportType) return
    setIsGenerating(true)
    setError(null)
    try {
      const data = await api.generateReport({
        projectKey: selectedProject.key,
        sprintId: selectedSprint.id,
        reportType: selectedReportType,
      })
      setReport(data)
      setStep('report')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate report')
    } finally {
      setIsGenerating(false)
    }
  }

  function handleDisconnect() {
    setStep('connect')
    setConnectionStatus('disconnected')
    setIsDemoMode(false)
    setProjects([])
    setSelectedProject(null)
    setSprints([])
    setSelectedSprint(null)
    setSelectedReportType(null)
    setReport(null)
    setError(null)
  }

  function handleBackToProjects() {
    setSelectedProject(null)
    setSprints([])
    setSelectedSprint(null)
    setSelectedReportType(null)
    setReport(null)
    setError(null)
    setStep('projects')
  }

  function handleBackToSprints() {
    setSelectedSprint(null)
    setSelectedReportType(null)
    setReport(null)
    setError(null)
    setStep('sprints')
  }

  function handleBackToReportType() {
    setReport(null)
    setError(null)
    setStep('report-type')
  }

  return (
    <div className="min-h-screen flex flex-col">
      <StatusBar
        connectionStatus={connectionStatus}
        isDemoMode={isDemoMode}
        onDisconnect={handleDisconnect}
      />

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <AnimatePresence mode="wait">
          {isLoading && <LoadingSpinner key="loading" message="Loading..." />}

          {!isLoading && error && step !== 'connect' && step !== 'report-type' && (
            <ErrorDisplay
              key="error"
              message={error}
              onRetry={() => {
                setError(null)
                if (step === 'projects') loadProjects()
                if (step === 'sprints' && selectedProject) handleSelectProject(selectedProject)
              }}
            />
          )}

          {!isLoading && !error && step === 'connect' && (
            <ConnectionForm
              key="connect"
              onConnect={handleConnect}
              onDemoMode={handleDemoMode}
              connectionStatus={connectionStatus}
              error={error}
            />
          )}

          {!isLoading && !error && step === 'projects' && (
            <ProjectSelector
              key="projects"
              projects={projects}
              onSelect={handleSelectProject}
            />
          )}

          {!isLoading && !error && step === 'sprints' && selectedProject && (
            <SprintSelector
              key="sprints"
              sprints={sprints}
              projectName={selectedProject.name}
              onSelect={handleSelectSprint}
              onBack={handleBackToProjects}
            />
          )}

          {!isLoading && step === 'report-type' && selectedProject && selectedSprint && (
            <ReportTypeSelector
              key="report-type"
              projectName={selectedProject.name}
              sprintName={selectedSprint.name}
              selectedType={selectedReportType}
              onSelect={setSelectedReportType}
              onGenerate={handleGenerate}
              onBack={handleBackToSprints}
              isGenerating={isGenerating}
            />
          )}

          {!isLoading && step === 'report' && report && (
            <ReportViewer
              key="report"
              report={report}
              onBack={handleBackToReportType}
            />
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}
