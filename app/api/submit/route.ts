// app/api/submit/route.ts
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'
import { GoogleGenAI } from '@google/genai'

export const runtime = 'nodejs'

const API_KEY = process.env.GEMINI_API_KEY || ''
const MODEL_CANDIDATES = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-8b']

// ---------------- Helpers ----------------

// Accepts numbers, decimals, "a/b", and mixed numbers "a b/c"
function parseNumericOrFraction(input: string): number | null {
  if (typeof input !== 'string') return Number.isFinite(input as any) ? (input as any) : null
  const s = input.trim()

  // mixed "a b/c"
  const mixed = s.match(/^([+-]?\d+)\s+(\d+)\s*\/\s*(\d+)$/)
  if (mixed) {
    const whole = Number(mixed[1])
    const num = Number(mixed[2])
    const den = Number(mixed[3])
    if (!Number.isFinite(den) || den === 0) return null
    return whole + (whole >= 0 ? 1 : -1) * (num / den)
  }

  // simple "a/b"
  const frac = s.match(/^([+-]?\d+)\s*\/\s*([+-]?\d+)$/)
  if (frac) {
    const num = Number(frac[1])
    const den = Number(frac[2])
    if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return null
    return num / den
  }

  // plain number
  const asNum = Number(s)
  return Number.isFinite(asNum) ? asNum : null
}

function round2(x: number) {
  return Math.round(x * 100) / 100
}

// Use the same client as /api/generate
const ai = new GoogleGenAI({ apiKey: API_KEY })

async function genFeedbackWithModel(model: string, prompt: string) {
  const res = await ai.models.generateContent({
    model,
    contents: [{ role: 'user', parts: [{ text: prompt }]}],
  })
  const text = (res as any).text ?? (res as any).response?.text ?? ''
  return String(text || '').trim()
}

async function getFeedback(problem: string, user: number, correct: number, band: 'correct' | 'near' | 'wrong') {
  const prompt = `
You are a friendly Primary 5 math tutor (Singapore syllabus).
Write concise, encouraging feedback for the student based on the problem and their answer.

Style:
- Warm, supportive, and clear. Keep it 3–6 short lines.
- Use simple language; avoid heavy jargon.
- Use SGD when money appears.
- Use light emoji only if appropriate (1 max).

Rules by band:
- If "correct": Start with praise (e.g., "Great job!"). Then give a short outline of a clean method (2–3 steps).
- If "near": Say they're close. Provide 2–4 hints that help fix the mistake (rounding, units, operation order, fraction/decimal slip). Reveal the correct answer on the last line.
- If "wrong": Stay kind. Give 2–4 simple steps to solve it. Reveal the correct answer on the last line.

Problem:
${problem}

Student's (numeric) answer used for checking: ${user}
Correct answer: ${correct}
Outcome band: ${band}

Now produce the feedback only (no preface, no headings, no extra markup).
`.trim()

  let lastErr: any
  for (const model of MODEL_CANDIDATES) {
    try {
      const txt = await genFeedbackWithModel(model, prompt)
      if (txt) {
        console.log('[AI_FEEDBACK_OK]', { model, band, preview: txt.slice(0, 140) })
        return { text: txt, modelUsed: model }
      }
      throw new Error('Empty feedback text')
    } catch (e: any) {
      lastErr = e
      console.warn('[AI_FEEDBACK_FAIL]', { model, band, error: e?.message || String(e) })
    }
  }
  throw new Error('All feedback models failed. Last error: ' + (lastErr?.message || String(lastErr)))
}

// ---------------- Route ----------------

export async function POST(req: Request) {
  try {
    if (!API_KEY) {
      return NextResponse.json({ error: 'Missing GEMINI_API_KEY' }, { status: 500 })
    }

    const { sessionId, userAnswer } = (await req.json()) as {
      sessionId: string
      userAnswer: string
    }

    if (!sessionId || userAnswer === undefined || userAnswer === null) {
      return NextResponse.json({ error: 'Missing sessionId or userAnswer' }, { status: 400 })
    }

    // Read the problem
    const { data: session, error: sessionErr } = await supabase
      .from('math_problem_sessions')
      .select('id, problem_text, correct_answer')
      .eq('id', sessionId)
      .single()

    if (sessionErr || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const correct = Number(session.correct_answer)

    // Parse the student input
    const parsed = parseNumericOrFraction(String(userAnswer))
    if (parsed === null) {
      return NextResponse.json(
        { error: 'Please enter a valid number (e.g., 2.5) or fraction (e.g., 1/6 or 1 1/2).' },
        { status: 400 }
      )
    }

    // Save rounded value, grade on precise value
    const userForSaving = round2(parsed)
    const EPS = 1e-6
    const absDiff = Math.abs(parsed - correct)
    const relDiff = correct !== 0 ? absDiff / Math.abs(correct) : absDiff

    const isCorrect = absDiff <= EPS
    const isNear = !isCorrect && (relDiff <= 0.05 || absDiff <= 0.5)
    const band: 'correct' | 'near' | 'wrong' = isCorrect ? 'correct' : isNear ? 'near' : 'wrong'

    // Generate AI feedback
    let feedbackText = ''
    let modelUsed = 'n/a'
    try {
      const { text, modelUsed: used } = await getFeedback(session.problem_text, parsed, correct, band)
      feedbackText = text
      modelUsed = used
    } catch (e) {
      console.warn('[AI_FEEDBACK_FALLBACK]', (e as any)?.message || String(e))
      feedbackText = isCorrect
        ? `Great job! ✅ Your answer is correct. A clean way to solve it:\n1) Identify what's asked\n2) Set up the operations in order\n3) Compute carefully and check units`
        : isNear
        ? `So close! You’re nearly there.\n• Recheck your operation order and place value/units\n• Confirm any rounding only at the end\n• Try recomputing step by step\nFinal answer: ${correct}`
        : `Nice try! Let's break it down:\n• Identify givens and what's unknown\n• Choose the right operations and compute step by step\n• Check units and place value\nFinal answer: ${correct}`
    }

    // Save submission
    const { error: subErr } = await supabase
      .from('math_problem_submissions')
      .insert({
        session_id: sessionId,
        user_answer: userForSaving,
        is_correct: isCorrect,
        feedback_text: feedbackText,
      })

    if (subErr) throw subErr

    const res = NextResponse.json({
      is_correct: isCorrect,
      feedback: feedbackText,
      band,
      normalized_user_answer: userForSaving,
    })
    res.headers.set('x-feedback-model', modelUsed)
    res.headers.set('x-feedback-band', band)
    return res
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}
