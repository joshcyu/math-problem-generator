// app/api/hint/route.ts
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'
import { GoogleGenAI } from '@google/genai'

export const runtime = 'nodejs'

const API_KEY = process.env.GEMINI_API_KEY || ''
const MODEL_CANDIDATES = [
  'gemini-2.5-flash',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
]

async function genHintText(ai: GoogleGenAI, model: string, prompt: string) {
  const res = await ai.models.generateContent({
    model,
    contents: [{ role: 'user', parts: [{ text: prompt }]}],
    generationConfig: {
      temperature: 0.9,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 400,
    },
  })
  const text = (res as any).text ?? (res as any).response?.text ?? ''
  return String(text).trim()
}

export async function POST(req: Request) {
  try {
    if (!API_KEY) {
      return NextResponse.json({ error: 'Missing GEMINI_API_KEY' }, { status: 500 })
    }

    const { sessionId } = await req.json() as { sessionId?: string }
    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })
    }

    // Fetch the problem so the model has context (do NOT pass the correct answer)
    const { data: session, error } = await supabase
      .from('math_problem_sessions')
      .select('id, problem_text')
      .eq('id', sessionId)
      .single()

    if (error || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Parse difficulty if present, but we won’t force its use
    const idx = session.problem_text.indexOf(' | ')
    const difficulty = idx > 0 ? session.problem_text.slice(0, idx).trim().toUpperCase() : 'UNKNOWN'
    const plainProblem = idx > 0 ? session.problem_text.slice(idx + 3).trim() : session.problem_text

    const ai = new GoogleGenAI({ apiKey: API_KEY })

    const basePrompt = `
You are a friendly Primary 5 math tutor (Singapore syllabus).
Give 2–4 short hints that guide the student on HOW to solve the problem.
DO NOT reveal the final numeric answer.
Prefer steps, reminders (units, fractions/decimals, order of operations), and a gentle nudge.

Difficulty: ${difficulty}
Problem:
${plainProblem}

Return only the hints in short lines or bullet points (no extra preface).
`.trim()

    let lastErr: any
    for (const model of MODEL_CANDIDATES) {
      try {
        const hint = await genHintText(ai, model, basePrompt)
        if (hint) {
          console.log('[AI_HINT_OK]', { model, preview: hint.slice(0, 120) })
          return NextResponse.json({ hint })
        }
        throw new Error('Empty hint text')
      } catch (e: any) {
        lastErr = e
        console.warn('[AI_HINT_FAIL]', model, e?.message || String(e))
      }
    }

    throw new Error('All hint models failed. Last error: ' + (lastErr?.message || String(lastErr)))
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to generate hint' }, { status: 500 })
  }
}
