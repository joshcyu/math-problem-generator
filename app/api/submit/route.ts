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

const ai = new GoogleGenAI({ apiKey: API_KEY })

async function aiTextWithModel(model: string, prompt: string) {
  const res = await ai.models.generateContent({
    model,
    contents: [{ role: 'user', parts: [{ text: prompt }]}],
    // keep defaults; short outputs; robust to provider changes
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
- If "near": Say they're close. Provide 2–4 hints and actual mathematical steps that help fix the mistake (rounding, units, operation order, fraction/decimal slip). Reveal the correct answer on the last line.
- If "wrong": Stay kind. Give 2–4 simple and actual steps to solve it. Reveal the correct answer on the last line.

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
      const txt = await aiTextWithModel(model, prompt)
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

/**
 * Step-by-step solution for wrong (or near) answers.
 * Returns a short, numbered solution only (no extra headings).
 */
async function getStepByStepSolution(problem: string, correct: number) {
  const prompt = `
You are a Primary 5 math tutor (Singapore syllabus).
Provide a short, clear, step-by-step solution to the following problem.
Keep to 3–6 numbered steps. Use simple language. Use SGD if money appears.
End with "Answer: <value>" on the last line (use the numeric answer provided).

Problem:
${problem}

Correct answer (numeric): ${correct}

Output format (NO headings, NO extra commentary):
1) ...
2) ...
3) ...
Answer: ${correct}
`.trim()

  let lastErr: any
  for (const model of MODEL_CANDIDATES) {
    try {
      const txt = await aiTextWithModel(model, prompt)
      if (txt) {
        console.log('[AI_SOLUTION_OK]', { model, preview: txt.slice(0, 140) })
        return { text: txt, modelUsed: model }
      }
      throw new Error('Empty solution text')
    } catch (e: any) {
      lastErr = e
      console.warn('[AI_SOLUTION_FAIL]', { model, error: e?.message || String(e) })
    }
  }
  // Fallback plain steps
  const fallback = `1) Identify what's given and what's being asked.\n2) Choose the correct operations in order.\n3) Compute carefully and keep units consistent.\nAnswer: ${correct}`
  return { text: fallback, modelUsed: 'fallback' }
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
    let feedbackModel = 'n/a'
    try {
      const { text, modelUsed } = await getFeedback(session.problem_text, parsed, correct, band)
      feedbackText = text
      feedbackModel = modelUsed
    } catch (e) {
      console.warn('[AI_FEEDBACK_FALLBACK]', (e as any)?.message || String(e))
      feedbackText = isCorrect
        ? `Great job! ✅ Your answer is correct. A clean way to solve it:\n1) Identify what's asked\n2) Set up the operations in order\n3) Compute carefully and check units`
        : isNear
        ? `So close! You’re nearly there.\n• Recheck your operation order and place value/units\n• Confirm any rounding only at the end\n• Try recomputing step by step\nFinal answer: ${correct}`
        : `Nice try! Let's break it down:\n• Identify givens and what's unknown\n• Choose the right operations and compute step by step\n• Check units and place value\nFinal answer: ${correct}`
    }

    // Step-by-step solution (only when wrong; set to also include near if you prefer)
    let solutionSteps = ''
    let solutionModel = 'n/a'
    if (!isCorrect) {
      try {
        const { text, modelUsed } = await getStepByStepSolution(session.problem_text, correct)
        solutionSteps = text
        solutionModel = modelUsed
        // Since we can't alter schema, append to feedback_text for persistence/History UI.
        feedbackText = `${feedbackText}\n\nSolution (step-by-step):\n${solutionSteps}`
      } catch {
        // If step-by-step fails entirely, just keep feedbackText as-is
      }
    }

    // Save submission (schema unchanged)
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
      band,
      feedback: feedbackText,            // includes appended steps when not correct
      solution_steps: solutionSteps || null, // convenient for UI (optional)
      normalized_user_answer: userForSaving,
    })
    res.headers.set('x-feedback-model', feedbackModel)
    if (solutionSteps) res.headers.set('x-solution-model', solutionModel)
    res.headers.set('x-feedback-band', band)
    return res
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}
