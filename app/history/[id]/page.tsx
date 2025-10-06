import Link from 'next/link'
import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

type Submission = {
  id: string
  created_at: string
  user_answer: number
  is_correct: boolean
  feedback_text: string
}

type SessionRow = {
  id: string
  created_at: string
  problem_text: string
  correct_answer: number
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

export default async function SessionDetail({ params }: { params: { id: string } }) {
  const id = params.id

  const { data: session, error } = await supabase
    .from('math_problem_sessions')
    .select('id, created_at, problem_text, correct_answer')
    .eq('id', id)
    .single<SessionRow>()

  if (error || !session) return notFound()

  const parsed = parsePrefix(session.problem_text)

  const { data: submissions, error: subErr } = await supabase
    .from('math_problem_submissions')
    .select('id, created_at, user_answer, is_correct, feedback_text')
    .eq('session_id', id)
    .order('created_at', { ascending: true }) // timeline oldest → newest
  const subs = (submissions ?? []) as Submission[]

  const total = subs.length
  const correct = subs.filter(s => s.is_correct).length
  const acc = total ? Math.round((correct / total) * 100) : 0

  return (
    <main className="container mx-auto max-w-4xl px-4 py-10">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Session Details</h1>
          <p className="text-gray-600 mt-1">See attempts, feedback, and your accuracy for this problem.</p>
        </div>
        <Link href="/history" className="inline-flex items-center gap-2 text-blue-600 hover:underline">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M15 19l-7-7 7-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to History
        </Link>
      </div>

      {/* Problem Card */}
      <section className="relative overflow-hidden rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[11px] font-semibold tracking-wide px-2 py-0.5 rounded-full ring-1 ${difficultyBadgeClass(parsed.difficulty)}`}>
            {parsed.difficulty}
          </span>
          {parsed.probType !== 'UNKNOWN' && (
            <span className={`text-[11px] font-semibold tracking-wide px-2 py-0.5 rounded-full ring-1 ${typeBadgeClass(parsed.probType)}`}>
              {parsed.probType}
            </span>
          )}
          <span className="text-[11px] text-gray-400">
            Session ID: <span className="font-mono">{session.id}</span>
          </span>
          <span className="text-[11px] text-gray-400">• {new Date(session.created_at).toLocaleString()}</span>
        </div>

        <h2 className="mt-4 text-xl font-semibold text-gray-900">Problem</h2>
        <p className="mt-2 text-gray-800 leading-relaxed">{parsed.plain}</p>

        <div className="mt-4 grid gap-2 sm:grid-cols-4 text-sm text-gray-800">
          <div className="rounded-lg bg-gray-50 px-3 py-2">Correct answer: <b>{String(session.correct_answer)}</b></div>
          <div className="rounded-lg bg-gray-50 px-3 py-2">Submissions: <b>{total}</b></div>
          <div className="rounded-lg bg-gray-50 px-3 py-2">Correct: <b>{correct}</b></div>
          <div className="rounded-lg bg-gray-50 px-3 py-2">Accuracy: <b>{acc}%</b></div>
        </div>

        {/* Accuracy bar */}
        <div className="mt-3 h-2 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-green-400 to-emerald-500 transition-[width] duration-700"
            style={{ width: `${acc}%` }}
          />
        </div>
      </section>

      {/* Submissions Timeline */}
      <section className="mt-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Submissions Timeline</h3>

        {subErr && <p className="text-red-600 text-sm mb-3">{subErr.message}</p>}

        {subs.length === 0 ? (
          <p className="text-gray-600">No submissions yet.</p>
        ) : (
          <ol className="relative border-s border-gray-200 pl-6">
            {subs.map((sub, i) => {
              const ok = sub.is_correct
              return (
                <li key={sub.id} className="mb-6 ms-3">
                  {/* Node */}
                  <span
                    className={`absolute -start-3 mt-1 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-white ${
                      ok ? 'bg-green-500' : 'bg-yellow-400'
                    }`}
                    aria-hidden
                  >
                    {ok ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-white">
                        <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-white">
                        <path d="M12 8v4m0 4h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </span>

                  <div className={`rounded-xl border px-4 py-3 shadow-sm ${ok ? 'border-green-200 bg-green-50/60' : 'border-yellow-200 bg-yellow-50/60'}`}>
                    <div className="flex items-center justify-between gap-3 text-xs text-gray-500">
                      <span>{new Date(sub.created_at).toLocaleString()}</span>
                      <span className="font-mono">#{i + 1} • {sub.id}</span>
                    </div>
                    <div className="mt-1 text-gray-900">
                      Answer: <b>{String(sub.user_answer)}</b> • Status: {ok ? '✅ Correct' : '❌ Not correct'}
                    </div>
                    {sub.feedback_text && (
                      <div className="mt-2 text-sm text-gray-800 whitespace-pre-wrap">
                        <b>Feedback:</b> {sub.feedback_text}
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </section>
    </main>
  )
}
