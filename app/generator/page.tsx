'use client'

import { useEffect, useRef, useState } from 'react'

type Difficulty = 'EASY' | 'MEDIUM' | 'HARD'
type ProbType = 'ADDITION' | 'SUBTRACTION' | 'MULTIPLICATION' | 'DIVISION'

type ProblemItem = {
  sessionId: string
  problem_text: string
  final_answer: number
  userAnswer: string
  isSubmitting: boolean
  feedback: string
  isCorrect: boolean | null
  difficulty: Difficulty
  probType: ProbType
  hint?: string
  isHinting?: boolean
}

type ScorePayload = {
  attempted: number
  score: number
  byDifficulty: {
    EASY: { attempted: number; score: number }
    MEDIUM: { attempted: number; score: number }
    HARD: { attempted: number; score: number }
  }
}

/* Helper UI pieces  */

function Badge({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`text-xs font-semibold tracking-wide px-2.5 py-1 rounded-full ${className}`}>
      {children}
    </span>
  )
}

// Strip "DIFFICULTY | PROBTYPE | " prefix
function stripPrefix(text: string) {
  const first = text.indexOf(' | ')
  if (first < 0) return text
  const second = text.indexOf(' | ', first + 3)
  if (second < 0) return text.slice(first + 3).trim()
  return text.slice(second + 3).trim()
}

function LoadingOverlay({ show }: { show: boolean }) {
  useEffect(() => {
    if (show) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = prev }
    }
  }, [show])

  if (!show) return null

  const glyphs = ['＋','－','×','÷','√','π','∑','≈','∞','≥','≤','≠','7','3','2','5','9','8','4','1']
  const items = new Array(28).fill(0).map((_, i) => {
    const g = glyphs[i % glyphs.length]
    return {
      g,
      dur: 8 + Math.random() * 6,
      delay: Math.random() * 4,
      size: 16 + Math.random() * 28,
      left: Math.random() * 100,
      top: Math.random() * 100,
      rotate: Math.random() * 360,
      opacity: 0.15 + Math.random() * 0.35,
      key: `${g}-${i}`,
    }
  })

  return (
    <div
      className="
        fixed inset-0 z-[200]
        grid place-items-center
        min-h-[100dvh]             /* dynamic VH for iOS/Android */
        pt-[env(safe-area-inset-top)]
        pb-[env(safe-area-inset-bottom)]
      "
    >
      {/* Blurred frosted backdrop */}
      <div className="absolute inset-0 h-[100dvh] bg-white/70 backdrop-blur-md" />

      {/* Floating glyphs layer */}
      <div className="pointer-events-none absolute inset-0 h-[100dvh] overflow-hidden">
        {items.map((it) => (
          <span
            key={it.key}
            className="absolute select-none animate-float"
            style={{
              left: `${it.left}%`,
              top: `${it.top}%`,
              fontSize: `${it.size}px`,
              animationDuration: `${it.dur}s`,
              animationDelay: `${it.delay}s`,
              transform: `rotate(${it.rotate}deg)`,
              opacity: it.opacity,
            }}
          >
            {it.g}
          </span>
        ))}
      </div>

      {/* Center content */}
      <div className="relative z-10 flex flex-col items-center gap-4 px-6 text-center max-w-xs sm:max-w-none">
        <div className="h-10 w-10 rounded-full border-4 border-blue-600/40 border-t-blue-600 animate-spin" />
        <div className="text-lg font-semibold text-gray-800 tracking-tight">
          Cooking up a fresh problem…
        </div>
        <div className="text-sm text-gray-600">Numbers aligning, operations humming ✨</div>
      </div>

      {/* Animations */}
      <style jsx global>{`
        @keyframes floaty {
          0%   { transform: translateY(0) rotate(0deg); }
          50%  { transform: translateY(-25px) rotate(10deg); }
          100% { transform: translateY(0) rotate(0deg); }
        }
        .animate-float {
          animation-name: floaty;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
        }
      `}</style>
    </div>
  )
}

function ScoreSummary({ refreshFlag }: { refreshFlag: number }) {
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [data, setData] = useState<ScorePayload | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        const res = await fetch('/api/score', { cache: 'no-store' })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Failed to load score')
        if (alive) setData(json)
      } catch (e: any) {
        if (alive) setErr(e?.message || 'Failed to load score')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [refreshFlag]) // only on mount + when refreshFlag changes

  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)

  return (
    <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-800">Score Summary</h3>
        {loading && (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span className="inline-block h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
            Loading…
          </div>
        )}
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}

      {!loading && data && (
        <>
          {/* Overall */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm mb-1">
              <div className="text-gray-700">
                Overall: <b>{data.score}</b> / <b>{data.attempted}</b>
                <span className="text-gray-500"> (first try only)</span>
              </div>
              <div className="text-xs text-gray-500">{pct(data.score, data.attempted)}%</div>
            </div>
            <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 transition-all" style={{ width: `${pct(data.score, data.attempted)}%` }} />
            </div>
          </div>

          {/* By difficulty */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(['EASY', 'MEDIUM', 'HARD'] as Difficulty[]).map((d) => {
              const entry = data.byDifficulty[d]
              const percent = pct(entry.score, entry.attempted)
              const palette =
                d === 'EASY'
                  ? { bar: 'bg-green-500', pill: 'bg-green-100 text-green-700' }
                  : d === 'MEDIUM'
                  ? { bar: 'bg-yellow-500', pill: 'bg-yellow-100 text-yellow-800' }
                  : { bar: 'bg-red-500', pill: 'bg-red-100 text-red-700' }

              return (
                <div key={d} className="rounded-lg border p-3 bg-white/70 hover:shadow-sm transition">
                  <div className="flex items-center justify-between mb-2">
                    <Badge className={palette.pill}>{d}</Badge>
                    <span className="text-xs text-gray-500">{percent}%</span>
                  </div>
                  <div className="text-sm font-medium text-gray-800 mb-2">
                    {entry.score} / {entry.attempted}
                  </div>
                  <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full ${palette.bar} transition-all`} style={{ width: `${percent}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {!loading && !err && !data && <p className="text-sm text-gray-500">No attempts yet.</p>}
    </div>
  )
}

/* ------------------------------ Page ------------------------------ */

export default function Home() {
  const [items, setItems] = useState<ProblemItem[]>([])
  const [activeIdx, setActiveIdx] = useState(0)
  const [throwDir, setThrowDir] = useState<'left' | 'right' | null>(null)

  const [isGenerating, setIsGenerating] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)
  const [difficulty, setDifficulty] = useState<Difficulty>('MEDIUM')
  const [probType, setProbType] = useState<ProbType>('ADDITION')

  // Score refetch control (mount + after submit only)
  const [scoreRefresh, setScoreRefresh] = useState(0)

  useEffect(() => {
    const v = localStorage.getItem('problems_session_started')
    if (v === '1') setHasStarted(true)
  }, [])
  useEffect(() => {
    localStorage.setItem('problems_session_started', hasStarted ? '1' : '0')
  }, [hasStarted])

  const startSession = () => {
    setHasStarted(true)
    setItems([])
    setActiveIdx(0)
  }

  const getHint = async (idx: number) => {
    const item = items[idx]
    if (!item?.sessionId) return
    try {
      setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, isHinting: true } : it)))
      const res = await fetch('/api/hint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: item.sessionId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to get hint')
      setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, isHinting: false, hint: data.hint } : it)))
    } catch (e: any) {
      alert(e.message || 'Failed to get hint')
      setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, isHinting: false } : it)))
    }
  }

  const generateProblem = async () => {
    try {
      setIsGenerating(true)
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ difficulty, probType }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to generate problem')

      setItems((prev) => {
        const next = [
          {
            sessionId: data.sessionId,
            problem_text: data.problem.problem_text, // "DIFF | TYPE | …"
            final_answer: data.problem.final_answer,
            userAnswer: '',
            isSubmitting: false,
            feedback: '',
            isCorrect: null,
            difficulty: data.difficulty as Difficulty,
            probType: data.probType as ProbType,
          },
          ...prev,
        ]
        setActiveIdx(0) // show newest
        return next
      })
    } catch (e: any) {
      alert(e.message || 'Failed to generate problem')
    } finally {
      setIsGenerating(false)
    }
  }

  const submitAnswer = async (idx: number) => {
    const item = items[idx]
    if (!item?.sessionId) return
    if (item.userAnswer.trim() === '') {
      alert('Please enter your answer.')
      return
    }

    try {
      setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, isSubmitting: true } : it)))

      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: item.sessionId, userAnswer: item.userAnswer }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to submit answer')

      setItems((prev) =>
        prev.map((it, i) =>
          i === idx ? { ...it, isSubmitting: false, feedback: data.feedback, isCorrect: data.is_correct } : it
        )
      )

      // Refresh scoreboard AFTER a successful submit only
      setScoreRefresh((n) => n + 1)
    } catch (e: any) {
      alert(e.message || 'Failed to submit answer')
      setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, isSubmitting: false } : it)))
    }
  }

  const active = items[activeIdx]

  // Throw pager
  const onNext = () => {
    if (activeIdx >= items.length - 1) return
    setThrowDir('right')
  }
  const onPrev = () => {
    if (activeIdx <= 0) return
    setThrowDir('left')
  }

  // Commit index change after animation
  const throwRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = throwRef.current
    if (!el) return
    const onAnimEnd = () => {
      if (throwDir === 'right') setActiveIdx((i) => Math.min(i + 1, items.length - 1))
      else if (throwDir === 'left') setActiveIdx((i) => Math.max(i - 1, 0))
      setThrowDir(null)
    }
    el.addEventListener('animationend', onAnimEnd)
    return () => el.removeEventListener('animationend', onAnimEnd)
  }, [throwDir, items.length])

  const hasCards = items.length > 0
  const canPrev = activeIdx > 0
  const canNext = activeIdx < items.length - 1

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="text-4xl font-bold text-center mb-8 text-gray-800">Math Problem Generator</h1>

        {/* Scoreboard (fetches only on mount + after submit) */}
        <ScoreSummary refreshFlag={scoreRefresh} />

        {/* Gate card */}
        {!hasStarted && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Create problems session</h2>
            <p className="text-gray-600 mb-4">
              Start a new session to generate problems. You can always answer existing problems from “Session list”.
            </p>
            <button
              onClick={startSession}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition"
            >
              Create problems session
            </button>
          </div>
        )}

        {/* Controls */}
        {hasStarted && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div className="flex items-center gap-3">
                <label htmlFor="difficulty" className="text-sm font-medium text-gray-700">Difficulty</label>
                <select
                  id="difficulty"
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                  className="px-3 py-2 border rounded-md text-sm"
                >
                  <option value="EASY">Easy</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HARD">Hard</option>
                </select>
              </div>

              <div className="flex items-center gap-3">
                <label htmlFor="ptype" className="text-sm font-medium text-gray-700">Problem Type</label>
                <select
                  id="ptype"
                  value={probType}
                  onChange={(e) => setProbType(e.target.value as ProbType)}
                  className="px-3 py-2 border rounded-md text-sm"
                >
                  <option value="ADDITION">Addition</option>
                  <option value="SUBTRACTION">Subtraction</option>
                  <option value="MULTIPLICATION">Multiplication</option>
                  <option value="DIVISION">Division</option>
                </select>
              </div>
            </div>

            <button
              onClick={generateProblem}
              disabled={isGenerating}
              className={`w-full text-white font-bold py-3 px-4 rounded-lg transition duration-200 ease-in-out transform
                ${isGenerating ? 'bg-blue-400 cursor-not-allowed animate-pulse' : 'bg-blue-600 hover:bg-blue-700 hover:scale-[1.02]'}`}
            >
              <span className="inline-flex items-center justify-center gap-2">
                {isGenerating && <span className="h-4 w-4 rounded-full border-2 border-white/60 border-t-transparent animate-spin" />}
                {isGenerating ? 'Generating...' : 'Generate New Problem'}
              </span>
            </button>

            {hasCards && <p className="mt-3 text-sm text-gray-500 text-center">Use the arrows below to browse your generated questions.</p>}
          </div>
        )}

        {/* Card Viewer */}
        {hasCards && active && (
          <div>
            <div
              ref={throwRef}
              className={`bg-white rounded-xl shadow-lg p-6 mb-4 border border-gray-100 will-change-transform
                ${throwDir === 'right' ? 'animate-throw-right' : ''}
                ${throwDir === 'left' ? 'animate-throw-left' : ''}
                ${throwDir === null ? 'animate-card-enter' : ''}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    className={
                      active.difficulty === 'HARD'
                        ? 'bg-red-100 text-red-700'
                        : active.difficulty === 'MEDIUM'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-green-100 text-green-700'
                    }
                  >
                    {active.difficulty}
                  </Badge>

                  <Badge
                    className={
                      active.probType === 'ADDITION'
                        ? 'bg-blue-100 text-blue-700'
                        : active.probType === 'SUBTRACTION'
                        ? 'bg-purple-100 text-purple-700'
                        : active.probType === 'MULTIPLICATION'
                        ? 'bg-pink-100 text-pink-700'
                        : 'bg-orange-100 text-orange-700'
                    }
                  >
                    {active.probType}
                  </Badge>

                  <h2 className="text-lg font-semibold text-gray-700 ml-1">Problem #{items.length - activeIdx}</h2>
                </div>
                <span className="text-xs text-gray-400">Session: {active.sessionId.slice(0, 8)}…</span>
              </div>

              <p className="text-gray-800 leading-relaxed mb-4">{stripPrefix(active.problem_text)}</p>

              {/* Actions */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">Your Answer</label>
                <input
                  type="text"
                  inputMode="text"
                  pattern="^\\s*[+\\-]?(?:\\d+(?:\\.\\d+)?|\\d+\\s*/\\s*\\d+|\\d+\\s+\\d+\\s*/\\s*\\d+)\\s*$"
                  title="Enter a number like 2.5, a fraction like 1/6, or a mixed number like 1 1/2"
                  value={active.userAnswer}
                  onChange={(e) => {
                    const val = e.target.value
                    setItems((prev) => prev.map((it, i) => (i === activeIdx ? { ...it, userAnswer: val } : it)))
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., 2.5 or 1/6 or 1 1/2"
                />

                <div className="flex gap-2">
                  <button
                    onClick={() => getHint(activeIdx)}
                    disabled={active.isHinting}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2.5 px-4 rounded-lg transition"
                  >
                    {active.isHinting ? 'Getting hint…' : 'Get hint'}
                  </button>

                  <button
                    onClick={() => submitAnswer(activeIdx)}
                    disabled={active.isSubmitting || active.userAnswer.trim() === ''}
                    className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold py-2.5 px-4 rounded-lg transition"
                  >
                    {active.isSubmitting ? 'Submitting…' : 'Submit Answer'}
                  </button>
                </div>
              </div>

              {/* Hint */}
              {active.hint && (
                <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
                  <h4 className="text-sm font-semibold text-blue-800 mb-1">Hint</h4>
                  <p className="text-blue-900 whitespace-pre-wrap text-sm">{active.hint}</p>
                </div>
              )}

              {/* Feedback */}
              {active.feedback && (
                <div
                  className={`mt-5 rounded-lg shadow-inner p-4 ${
                    active.isCorrect ? 'bg-green-50 border-2 border-green-200' : 'bg-yellow-50 border-2 border-yellow-200'
                  }`}
                >
                  <h3 className="text-md font-semibold mb-2 text-gray-700">
                    {active.isCorrect ? '✅ Correct!' : '❌ Not quite right'}
                  </h3>
                  <p className="text-gray-800 whitespace-pre-wrap">{active.feedback}</p>
                </div>
              )}
            </div>

            {/* Pager */}
            <div className="flex items-center justify-between gap-4">
              <button
                onClick={onPrev}
                disabled={!canPrev || throwDir !== null}
                className="flex-1 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-800 font-medium py-2 rounded-lg transition"
              >
                ← Previous
              </button>
              <div className="text-xs text-gray-500">
                {activeIdx + 1} / {items.length}
              </div>
              <button
                onClick={onNext}
                disabled={!canNext || throwDir !== null}
                className="flex-1 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-800 font-medium py-2 rounded-lg transition"
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {/* Empty state hints */}
        {hasStarted && !hasCards && (
          <p className="text-center text-gray-500">Click “Generate New Problem” to get started.</p>
        )}
        {!hasStarted && <p className="text-center text-gray-500">Click “Create problems session” to begin.</p>}
      </main>

      {/* Throw & enter animations */}
      <style jsx global>{`
        @keyframes throwRight {
          0%   { transform: translate(0, 0) rotate(0deg); opacity: 1; }
          100% { transform: translate(120%, -20%) rotate(12deg); opacity: 0; }
        }
        @keyframes throwLeft {
          0%   { transform: translate(0, 0) rotate(0deg); opacity: 1; }
          100% { transform: translate(-120%, -20%) rotate(-12deg); opacity: 0; }
        }
        @keyframes cardEnter {
          0%   { transform: translateY(10px) scale(0.98); opacity: 0; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        .animate-throw-right { animation: throwRight 420ms cubic-bezier(0.22, 1, 0.36, 1) forwards; }
        .animate-throw-left  { animation: throwLeft  420ms cubic-bezier(0.22, 1, 0.36, 1) forwards; }
        .animate-card-enter  { animation: cardEnter  300ms ease-out; }
      `}</style>

      {/* Full-screen animated overlay while generating */}
      <LoadingOverlay show={isGenerating} />
    </div>
  )
}
