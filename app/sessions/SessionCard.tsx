'use client'

import Link from 'next/link'
import { useState } from 'react'

type Difficulty = 'EASY' | 'MEDIUM' | 'HARD'
type ProbType = 'ADDITION' | 'SUBTRACTION' | 'MULTIPLICATION' | 'DIVISION' | 'UNKNOWN'

type Props = {
  sessionId: string
  problemText: string   // plain text (prefix already stripped)
  difficulty: Difficulty
  probType?: ProbType
  createdAt?: string
}

export default function SessionCard({ sessionId, problemText, difficulty, probType = 'UNKNOWN', createdAt }: Props) {
  const [userAnswer, setUserAnswer] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)

  const submit = async () => {
    if (!userAnswer.trim()) return
    try {
      setIsSubmitting(true)
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, userAnswer }), // raw string supports fractions/mixed numbers
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to submit')
      setFeedback(data.feedback)
      setIsCorrect(data.is_correct)
    } catch (e: any) {
      alert(e.message || 'Failed to submit answer')
    } finally {
      setIsSubmitting(false)
    }
  }

  const diffBadge =
    difficulty === 'HARD'
      ? 'bg-red-100 text-red-700 ring-red-200'
      : difficulty === 'MEDIUM'
      ? 'bg-yellow-100 text-yellow-700 ring-yellow-200'
      : 'bg-green-100 text-green-700 ring-green-200'

  const typeBadge =
    probType === 'ADDITION'
      ? 'bg-blue-100 text-blue-700 ring-blue-200'
      : probType === 'SUBTRACTION'
      ? 'bg-purple-100 text-purple-700 ring-purple-200'
      : probType === 'MULTIPLICATION'
      ? 'bg-pink-100 text-pink-700 ring-pink-200'
      : probType === 'DIVISION'
      ? 'bg-orange-100 text-orange-700 ring-orange-200'
      : 'bg-gray-100 text-gray-700 ring-gray-200'

  return (
    <li className="group relative overflow-hidden rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md">
      {/* Accent gradient bar */}
      <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-blue-400 to-indigo-500 opacity-70" />

      <div className="flex items-start justify-between gap-4">
        <div className="w-full pr-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[11px] font-semibold tracking-wide px-2.5 py-1 rounded-full ring-1 ${diffBadge}`}>
                {difficulty}
              </span>
              {probType !== 'UNKNOWN' && (
                <span className={`text-[11px] font-semibold tracking-wide px-2.5 py-1 rounded-full ring-1 ${typeBadge}`}>
                  {probType}
                </span>
              )}
              <span className="text-[11px] text-gray-400">Session: <span className="font-mono">{sessionId.slice(0, 8)}…</span></span>
              {createdAt && (
                <span className="text-[11px] text-gray-400">• {new Date(createdAt).toLocaleString()}</span>
              )}
            </div>

            <Link
              href={`/history/${sessionId}`}
              className="shrink-0 hidden sm:inline-flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
              title="View submission history"
            >
              History
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M8 5l7 7-7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
          </div>

          <p className="mt-2 text-gray-900 leading-relaxed">{problemText}</p>

          {/* Answer form */}
          <div className="mt-4 space-y-2">
            <label className="block text-sm font-medium text-gray-700">Your Answer</label>
            <input
              type="text"
              inputMode="text"
              pattern="^\s*[+\-]?(?:\d+(?:\.\d+)?|\d+\s*/\s*\d+|\d+\s+\d+\s*/\s*\d+)\s*$"
              title="Enter a number like 2.5, a fraction like 1/6, or a mixed number like 1 1/2"
              placeholder="e.g., 2.5 or 1/6 or 1 1/2"
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
            />

            <button
              onClick={submit}
              disabled={isSubmitting || !userAnswer.trim()}
              className={`w-full rounded-lg px-4 py-2.5 font-semibold text-white transition
                ${isSubmitting ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700 active:scale-[0.99]'}`}
            >
              {isSubmitting ? 'Submitting…' : 'Submit Answer'}
            </button>
          </div>

          {/* Feedback */}
          {feedback && (
            <div
              className={`mt-4 rounded-xl border p-4 shadow-inner ${
                isCorrect ? 'border-green-200 bg-green-50' : 'border-yellow-200 bg-yellow-50'
              }`}
            >
              <h3 className="text-sm font-semibold text-gray-800 mb-1">
                {isCorrect ? '✅ Correct!' : '❌ Not quite right'}
              </h3>
              <p className="text-gray-900 whitespace-pre-wrap text-sm">{feedback}</p>
              <div className="mt-3">
                <Link
                  href={`/history/${sessionId}`}
                  className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                >
                  See full feedback timeline
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M8 5l7 7-7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </li>
  )
}
