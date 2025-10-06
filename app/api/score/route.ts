// app/api/score/route.ts
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'

type Difficulty = 'EASY' | 'MEDIUM' | 'HARD' | 'UNKNOWN'
type FirstSub = { session_id: string; is_correct: boolean; created_at: string }

// Find EASY/MEDIUM/HARD anywhere in the prefix segments.
// Robust to BOM, zero-width chars, extra spaces, mixed case, and “DIFF | TYPE | …” variants.
function parseDifficulty(problemText: string): Difficulty {
  if (!problemText) return 'UNKNOWN'
  const cleaned = problemText
    .replace(/[\uFEFF\u200B-\u200D\u2060]/g, '') // BOM + zero-width spaces
    .trim()

  const segments = cleaned.split('|').map(s => s.trim().toUpperCase())
  const hit = segments.find(s => s === 'EASY' || s === 'MEDIUM' || s === 'HARD')
  return (hit as Difficulty) || 'UNKNOWN'
}


export const revalidate = 0
export const runtime = 'nodejs'

export async function GET() {
  try {
    // 1) Get all submissions (ASC so first entry per session is the earliest)
    const { data: subs, error: subsErr } = await supabase
      .from('math_problem_submissions')
      .select('session_id, is_correct, created_at')
      .order('created_at', { ascending: true })

    if (subsErr) throw subsErr

    // 2) Build first-submission map
    const firstBySession = new Map<string, FirstSub>()
    for (const s of subs ?? []) {
      if (!firstBySession.has(s.session_id)) {
        firstBySession.set(s.session_id, {
          session_id: s.session_id,
          is_correct: !!s.is_correct,
          created_at: s.created_at as string,
        })
      }
    }

    const attemptedSessionIds = Array.from(firstBySession.keys())
    const attemptedCount = attemptedSessionIds.length

    // If no attempts, return zeros early
    if (attemptedSessionIds.length === 0) {
      return NextResponse.json({
        attempted: 0,
        score: 0,
        byDifficulty: {
          EASY: { attempted: 0, score: 0 },
          MEDIUM: { attempted: 0, score: 0 },
          HARD: { attempted: 0, score: 0 },
        },
      })
    }

    // 3) Fetch corresponding sessions to read problem_text -> difficulty
    const { data: sessions, error: sessErr } = await supabase
      .from('math_problem_sessions')
      .select('id, problem_text')
      .in('id', attemptedSessionIds)

    if (sessErr) throw sessErr

    const difficultyBySession: Record<string, Difficulty> = {}
    for (const s of sessions ?? []) {
      difficultyBySession[s.id] = parseDifficulty(s.problem_text || '')
    }

    // 4) Tally score using FIRST submission only
    let totalScore = 0
    const byDifficulty: Record<'EASY' | 'MEDIUM' | 'HARD', { attempted: number; score: number }> = {
      EASY: { attempted: 0, score: 0 },
      MEDIUM: { attempted: 0, score: 0 },
      HARD: { attempted: 0, score: 0 },
    }

    firstBySession.forEach((first, sessionId) => {
      const diff = difficultyBySession[sessionId] || 'UNKNOWN'
      const firstScore = first.is_correct ? 1 : 0
      totalScore += firstScore

      if (diff === 'EASY' || diff === 'MEDIUM' || diff === 'HARD') {
        byDifficulty[diff].attempted += 1
        byDifficulty[diff].score += firstScore
      }
    })

    return NextResponse.json({
      attempted: attemptedCount,
      score: totalScore,
      byDifficulty,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to compute score' }, { status: 500 })
  }
}
