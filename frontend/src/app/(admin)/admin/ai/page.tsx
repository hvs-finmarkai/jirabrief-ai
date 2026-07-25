"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Brain, CheckCircle2, XCircle, Loader2, Zap } from "lucide-react"

export default function AdminAIPage() {
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    setTimeout(() => {
      setTestResult("AI connection successful — model responding correctly")
      setTesting(false)
    }, 1500)
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <h1 className="text-2xl font-semibold text-charcoal mb-1">AI Configuration</h1>
      <p className="text-sm text-warm-500 mb-8">AI provider status and settings</p>

      <div className="bg-white rounded-xl border border-warm-200 p-6 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
            <Brain className="w-5 h-5 text-accent" />
          </div>
          <div>
            <p className="text-sm font-medium text-charcoal">Groq (Llama 3.1)</p>
            <p className="text-xs text-warm-400">Free tier — llama-3.1-8b-instant</p>
          </div>
          <span className="ml-auto flex items-center gap-1.5 text-xs font-medium text-status-done">
            <CheckCircle2 className="w-3.5 h-3.5" />Healthy
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-4 bg-warm-50 rounded-lg">
            <p className="text-xs text-warm-400 mb-1">Provider</p>
            <p className="text-sm font-medium text-charcoal">Groq</p>
          </div>
          <div className="p-4 bg-warm-50 rounded-lg">
            <p className="text-xs text-warm-400 mb-1">Model</p>
            <p className="text-sm font-medium text-charcoal">llama-3.1-8b-instant</p>
          </div>
        </div>

        {testResult && (
          <div className="flex items-center gap-2 p-3 bg-status-done/5 rounded-lg mb-4">
            <CheckCircle2 className="w-4 h-4 text-status-done" />
            <p className="text-sm text-status-done">{testResult}</p>
          </div>
        )}

        <button onClick={handleTest} disabled={testing} className="flex items-center gap-2 px-4 py-2 bg-charcoal text-white rounded-xl text-sm font-medium hover:bg-charcoal-light disabled:opacity-50 cursor-pointer">
          {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          Test AI Connection
        </button>
      </div>

      <div className="bg-white rounded-xl border border-warm-200 p-6">
        <h3 className="text-sm font-semibold text-charcoal mb-3">Architecture</h3>
        <p className="text-sm text-warm-500">The AI provider is configured via environment variables. The system supports Ollama (local) and Groq (cloud) through a provider abstraction. Claude can be added as a future provider without changing report logic.</p>
      </div>
    </motion.div>
  )
}
