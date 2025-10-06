import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import SessionCard from './SessionCard'

type SessionRow = {
  id: string
  created_at: string
  problem_text: string
}

type Difficulty = 'EASY' | 'MEDIUM' | 'HARD'
type ProbType = 'ADDITION' | 'SUBTRACTION' | 'MULTIPLICATION' | 'DIVISION' | 'UNKNOWN'
const DIFFS: Difficulty[] = ['EASY', 'MEDIUM', 'HARD']

export const revalidate = 0

// Parse "DIFFICULTY | PROBTYPE | Problem..." (or older "DIFFICULTY | Problem...")
function parsePrefix(problemText: string): {
  difficulty: Difficulty | 'UNKNOWN'
  probType: ProbType
  plain: string
} {
  if (!problemText) return { difficulty: 'UNKNOWN', probType: 'UNKNOWN', plain: '' }
  const parts = problemText.split(' | ')
  const d = (parts[0]?.trim().toUpperCase() ?? '') as Difficulty
  const maybeType = (parts[1]?.trim().toUpperCase() ?? '') as ProbType
  const hasType = ['ADDITION','SUBTRACTION','MULTIPLICATION','DIVISION'].includes(maybeType)
  const plain = hasType
    ? parts.slice(2).join(' | ').trim()
    : parts.slice(1).join(' | ').trim()
  return {
    difficulty: DIFFS.includes(d) ? d : 'UNKNOWN',
    probType: hasType ? maybeType : 'UNKNOWN',
    plain: plain || problemText,
  }
}

export default async function SessionsPage({ searchParams }: { searchParams: { difficulty?: string } }) {
  const selected = (searchParams?.difficulty || 'ALL').toUpperCase()
  const selectedDiff = (['EASY', 'MEDIUM', 'HARD', 'ALL'].includes(selected) ? selected : 'ALL') as Difficulty | 'ALL'

  const { data, error } = await supabase
    .from('math_problem_sessions')
    .select('id, created_at, problem_text')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    return (
      <main className="container mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-3xl font-bold mb-6 text-gray-900">Session list</h1>
        <p className="text-red-600">Failed to load sessions: {error.message}</p>
      </main>
    )
  }

  const rows = (data ?? []) as SessionRow[]

  // enrich with parsed badges + plain text
  const enriched = rows.map((s) => {
    const parsed = parsePrefix(s.problem_text)
    return { ...s, ...parsed }
  })

  // optional filtering
  const filtered = selectedDiff === 'ALL'
    ? enriched
    : enriched.filter((s) => s.difficulty === selectedDiff)

  // group by difficulty (HARD → MEDIUM → EASY)
  const groups: Record<Difficulty, typeof filtered> = { HARD: [], MEDIUM: [], EASY: [] }
  for (const s of filtered) {
    if (s.difficulty === 'HARD' || s.difficulty === 'MEDIUM' || s.difficulty === 'EASY') {
      groups[s.difficulty].push(s)
    }
  }

  const countAll = enriched.length
  const countBy = {
    HARD: enriched.filter((x) => x.difficulty === 'HARD').length,
    MEDIUM: enriched.filter((x) => x.difficulty === 'MEDIUM').length,
    EASY: enriched.filter((x) => x.difficulty === 'EASY').length,
  }

  const badgeClass = (d: Difficulty) =>
    d === 'HARD'
      ? 'bg-red-100 text-red-700 ring-red-200'
      : d === 'MEDIUM'
      ? 'bg-yellow-100 text-yellow-700 ring-yellow-200'
      : 'bg-green-100 text-green-700 ring-green-200'

  const filterLink = (label: string, to: string, active: boolean) => (
    <Link
      href={to}
      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition
        ${active ? 'bg-blue-600 text-white border-blue-600 shadow' : 'bg-white text-gray-800 border-gray-200 hover:bg-gray-50'}`}
    >
      {label}
      {active && (
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-white/80" />
      )}
    </Link>
  )

  return (
    <main className="container mx-auto max-w-5xl px-4 py-10">
      {/* Header + Filters */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Session list</h1>
          <p className="text-gray-600 mt-1">Answer any saved problem directly from this page.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {filterLink(`All (${countAll})`, '/sessions', selectedDiff === 'ALL')}
          {filterLink(`Hard (${countBy.HARD})`, '/sessions?difficulty=HARD', selectedDiff === 'HARD')}
          {filterLink(`Medium (${countBy.MEDIUM})`, '/sessions?difficulty=MEDIUM', selectedDiff === 'MEDIUM')}
          {filterLink(`Easy (${countBy.EASY})`, '/sessions?difficulty=EASY', selectedDiff === 'EASY')}
        </div>
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border bg-white px-6 py-14 text-center">
          <div className="text-5xl text-blue-100 select-none mb-2">∑</div>
          <p className="text-gray-600">No sessions yet for this filter. Try generating a problem on the <Link href="/generator" className="text-blue-600 hover:underline">Generator</Link>.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {(['HARD', 'MEDIUM', 'EASY'] as Difficulty[]).map((d) =>
            groups[d].length ? (
              <section key={d}>
                <div className="mb-3 flex items-center gap-3">
                  <span className={`text-[11px] font-semibold tracking-wide px-2.5 py-1 rounded-full ring-1 ${badgeClass(d)}`}>
                    {d}
                  </span>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {groups[d].length} problem{groups[d].length > 1 ? 's' : ''}
                  </h2>
                </div>

                <ul className="grid gap-4 md:grid-cols-2">
                  {groups[d].map((s) => (
                    <SessionCard
                      key={s.id}
                      sessionId={s.id}
                      problemText={s.plain}
                      difficulty={d}
                      probType={s.probType as ProbType}
                      createdAt={s.created_at}
                    />
                  ))}
                </ul>
              </section>
            ) : null
          )}
        </div>
      )}
    </main>
  )
}
