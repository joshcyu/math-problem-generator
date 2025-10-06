import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'

type Submission = { id: string; is_correct: boolean; created_at: string }
type Session = {
  id: string
  created_at: string
  problem_text: string
  correct_answer: number
  submissions: Submission[]
}

type Difficulty = 'EASY' | 'MEDIUM' | 'HARD' | 'UNKNOWN'
type ProbType = 'ADDITION' | 'SUBTRACTION' | 'MULTIPLICATION' | 'DIVISION' | 'UNKNOWN'

export const revalidate = 0

function parsePrefix(pt: string): { difficulty: Difficulty; probType: ProbType; plain: string } {
  if (!pt) return { difficulty: 'UNKNOWN', probType: 'UNKNOWN', plain: '' }
  const parts = pt.split(' | ')
  const diff = (parts[0]?.trim().toUpperCase() ?? '') as Difficulty
  const type = (parts[1]?.trim().toUpperCase() ?? '') as ProbType
  const plain = parts.length >= 3 ? parts.slice(2).join(' | ').trim() : (parts[1] ? parts.slice(1).join(' | ').trim() : pt)
  return {
    difficulty: (diff === 'EASY' || diff === 'MEDIUM' || diff === 'HARD') ? diff : 'UNKNOWN',
    probType: (['ADDITION','SUBTRACTION','MULTIPLICATION','DIVISION'].includes(type)) ? type : 'UNKNOWN',
    plain,
  }
}

function difficultyBadgeClass(d: Difficulty) {
  if (d === 'HARD') return 'bg-red-100 text-red-700 ring-red-200'
  if (d === 'MEDIUM') return 'bg-yellow-100 text-yellow-700 ring-yellow-200'
  if (d === 'EASY') return 'bg-green-100 text-green-700 ring-green-200'
  return 'bg-gray-100 text-gray-700 ring-gray-200'
}

function typeBadgeClass(t: ProbType) {
  if (t === 'ADDITION') return 'bg-blue-100 text-blue-700 ring-blue-200'
  if (t === 'SUBTRACTION') return 'bg-purple-100 text-purple-700 ring-purple-200'
  if (t === 'MULTIPLICATION') return 'bg-pink-100 text-pink-700 ring-pink-200'
  if (t === 'DIVISION') return 'bg-orange-100 text-orange-700 ring-orange-200'
  return 'bg-gray-100 text-gray-700 ring-gray-200'
}

export default async function HistoryPage() {
  const { data, error } = await supabase
    .from('math_problem_sessions')
    .select('id, created_at, problem_text, correct_answer, submissions:math_problem_submissions(id,is_correct,created_at)')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    return (
      <main className="container mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-3xl font-bold mb-6 text-gray-900">History</h1>
        <p className="text-red-600">Failed to load history: {error.message}</p>
      </main>
    )
  }

  const sessions = (data ?? []) as Session[]

  return (
    <main className="container mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 tracking-tight">History</h1>
        <p className="text-gray-600 mt-1">Your recent sessions, accuracy, and progress at a glance.</p>
      </div>

      {/* Empty state with playful math glyphs */}
      {sessions.length === 0 && (
        <div className="relative overflow-hidden rounded-2xl border bg-white px-6 py-16 text-center">
          <div className="pointer-events-none absolute inset-0">
            <div className="animate-[float_6s_ease-in-out_infinite] absolute -left-8 top-8 text-5xl text-blue-100 select-none">√</div>
            <div className="animate-[float_7s_ease-in-out_infinite] absolute left-12 top-24 text-6xl text-yellow-100 select-none">%</div>
            <div className="animate-[float_5s_ease-in-out_infinite] absolute right-12 top-10 text-7xl text-pink-100 select-none">×</div>
            <div className="animate-[float_8s_ease-in-out_infinite] absolute right-6 bottom-6 text-6xl text-green-100 select-none">÷</div>
          </div>
          <h2 className="text-xl font-semibold text-gray-800 relative">No sessions yet</h2>
          <p className="text-gray-600 mt-1 relative">Head over to the Generator and create your first problem.</p>
          <Link
            href="/generator"
            className="relative mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-white font-medium shadow hover:bg-blue-700"
          >
            Start generating
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M7 12h10m0 0-4-4m4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
        </div>
      )}

      {/* List */}
      <ul className="grid gap-4">
        {sessions.map((s, idx) => {
          const total = s.submissions?.length ?? 0
          const correct = s.submissions?.filter(x => x.is_correct).length ?? 0
          const acc = total ? Math.round((correct / total) * 100) : 0
          const parsed = parsePrefix(s.problem_text)

          return (
            <li
              key={s.id}
              className="group relative overflow-hidden rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md"
            >
              {/* Accent bar */}
              <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-blue-400 to-indigo-500 opacity-70" />

              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="pr-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[11px] font-semibold tracking-wide px-2 py-0.5 rounded-full ring-1 ${difficultyBadgeClass(parsed.difficulty)}`}>
                      {parsed.difficulty}
                    </span>
                    {parsed.probType !== 'UNKNOWN' && (
                      <span className={`text-[11px] font-semibold tracking-wide px-2 py-0.5 rounded-full ring-1 ${typeBadgeClass(parsed.probType)}`}>
                        {parsed.probType}
                      </span>
                    )}
                    <span className="text-[11px] text-gray-400">Session #{sessions.length - idx}</span>
                    <span className="text-[11px] text-gray-400">• {new Date(s.created_at).toLocaleString()}</span>
                  </div>

                  <p className="mt-2 text-gray-900 leading-relaxed">{parsed.plain}</p>

                  {/* Stats row */}
                  <div className="mt-3 flex items-center flex-wrap gap-3 text-sm text-gray-700">
                    <div className="inline-flex items-center gap-1">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path d="M5 12h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                      Submissions: <b className="ml-1">{total}</b>
                    </div>
                    <div className="inline-flex items-center gap-1">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Correct: <b className="ml-1">{correct}</b>
                    </div>
                    <div className="inline-flex items-center gap-1">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path d="M4 18h16M4 18c5-8 11-8 16 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                      Accuracy: <b className="ml-1">{acc}%</b>
                    </div>
                  </div>

                  {/* Accuracy bar */}
                  <div className="mt-2 h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-green-400 to-emerald-500 transition-[width] duration-700"
                      style={{ width: `${acc}%` }}
                      aria-label={`Accuracy ${acc}%`}
                    />
                  </div>
                </div>

                <div className="shrink-0 pt-1">
                  <Link
                    href={`/history/${s.id}`}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-white text-sm font-medium shadow-sm hover:bg-blue-700"
                  >
                    View details
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M8 5l7 7-7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </Link>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </main>
  )
}
