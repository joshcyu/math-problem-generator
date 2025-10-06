// app/api/generate/route.ts
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'
import { GoogleGenAI } from '@google/genai'

export const runtime = 'nodejs'

type ProblemJSON = { problem_text: string; final_answer: number }
type Difficulty = 'EASY' | 'MEDIUM' | 'HARD'
type ProbType = 'ADDITION' | 'SUBTRACTION' | 'MULTIPLICATION' | 'DIVISION'

const API_KEY = process.env.GEMINI_API_KEY || ''

const MODEL_CANDIDATES = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-8b']

const TOPICS = [
  'whole numbers (multi-step word problems)',
  'fractions (addition/subtraction with unlike denominators)',
  'fractions (multiplication/division by whole numbers)',
  'decimals (money/context, addition & multiplication)',
  'ratio and proportion (part-whole)',
  'percentage (discounts, increases, tax)',
  'area/perimeter of rectangles & triangles',
  'rates & time (distance-speed-time, work rate)',
]

const PROB_TYPES: ProbType[] = ['ADDITION', 'SUBTRACTION', 'MULTIPLICATION', 'DIVISION']

const FALLBACKS: ProblemJSON[] = [
  { problem_text: 'A shop sells pencils at $0.80 each. Mei bought 6 pencils. How much did she pay in total?', final_answer: 4.8 },
  { problem_text: 'A tank holds 24 litres of water. Ben drinks 0.3 litres every 10 minutes. How much will he drink in 1 hour?', final_answer: 1.8 },
  { problem_text: 'A rectangle is 12 cm long and 5 cm wide. What is its perimeter?', final_answer: 34 },
]

function pick<T>(arr: T[], exclude?: T) {
  const filtered = exclude ? arr.filter(x => x !== exclude) : arr
  return filtered[Math.floor(Math.random() * filtered.length)]
}

function extractJson(s: string): string {
  if (!s) throw new Error('Empty model output')
  const fenced = s.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  try { JSON.parse(fenced); return fenced } catch {}
  const start = s.indexOf('{'); const end = s.lastIndexOf('}')
  if (start >= 0 && end > start) {
    const cand = s.slice(start, end + 1).trim()
    JSON.parse(cand); return cand
  }
  throw new Error('No JSON object found in model output')
}

const ai = new GoogleGenAI({ apiKey: API_KEY })

async function genOnceWithModel(model: string, prompt: string) {
  // Try JSON mode first; fall back to plain
  try {
    const r = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.9,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 512,
        response_mime_type: 'application/json' as any, // tolerated by some backends
      } as any,
    })
    const text = (r as any).text ?? (r as any).response?.text ?? ''
    if (text && typeof text === 'string') return { text, usedJsonMode: true }
  } catch (e: any) {
    if (!String(e?.message || e).includes('responseMime')) throw e
  }

  const r2 = await ai.models.generateContent({
    model,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.9,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 512,
    },
  })
  const text2 = (r2 as any).text ?? (r2 as any).response?.text ?? ''
  return { text: text2, usedJsonMode: false }
}

function difficultyGuidance(d: Difficulty) {
  if (d === 'EASY') {
    return `
- 1 step (or very simple 2 steps), small integers.
- No tricky unit conversions. Avoid complex fractions/ratios.
- Suitable for quick mental/short working.
`.trim()
  }
  if (d === 'HARD') {
    return `
- 2–3 steps with careful reasoning.
- Include ratios/percentages/fractions/decimals interplay or a subtle trap (unit/rounding), but keep a single numeric final answer.
- Numbers still reasonable for P5; avoid huge or unrealistic values.
`.trim()
  }
  return `
- 2 steps typical P5 difficulty.
- Allow fractions/decimals or percentage with one conversion.
- Single numeric final answer; clear, unambiguous wording.
`.trim()
}

function probTypeGuidance(t: ProbType) {
  switch (t) {
    case 'ADDITION':
      return 'The main operation to solve the problem must be addition.'
    case 'SUBTRACTION':
      return 'The main operation to solve the problem must be subtraction.'
    case 'MULTIPLICATION':
      return 'The main operation to solve the problem must be multiplication.'
    case 'DIVISION':
      return 'The main operation to solve the problem must be division.'
  }
}

async function generateOnce(topicHint: string, diff: Difficulty, ptype: ProbType) {
  const nonce = Math.random().toString(36).slice(2)

  const basePrompt = (simple = false) => (simple
    ? `Return ONLY valid JSON (no code fences, no extra text) with exactly these keys:
{"problem_text": "string", "final_answer": number}
Primary 5 (Singapore 2021 syllabus) word problem.
Difficulty: ${diff}.
Problem type: ${ptype}. ${probTypeGuidance(ptype)}
Guidance:
${difficultyGuidance(diff)}
Topic: ${topicHint}.
Use SGD when money appears.
Ensure a single numerical final answer.`
    : `You are generating ONE Primary 5 (Singapore 2021 syllabus) math word problem.

Difficulty: ${diff}
Problem type: ${ptype}. ${probTypeGuidance(ptype)}
Guidance:
${difficultyGuidance(diff)}

Requirements:
- Topic focus: ${topicHint}
- Use SGD when money appears.
- Keep numbers reasonable.
- Clear, unambiguous wording with a single numerical final answer.
- The core computation to reach the final answer must use ${ptype.toLowerCase()}.
- Return ONLY valid JSON with exactly two keys and no extra text, no code fences:
{"problem_text": "string", "final_answer": number}

Extra:
- Avoid repeating stock problems.
- Make it novel w.r.t. nonce: ${nonce}.
- If decimals occur, round to 2 d.p. in the final answer.`).trim()

  let lastErr: any
  for (const model of MODEL_CANDIDATES) {
    try {
      const a1 = await genOnceWithModel(model, basePrompt(false))
      console.log('[AI_GEN_RAW]', { model, diff, ptype, topic: topicHint, preview: String(a1.text).slice(0, 160) })
      try {
        const json1 = extractJson(a1.text)
        const parsed1 = JSON.parse(json1) as ProblemJSON
        if (!parsed1?.problem_text || typeof parsed1.final_answer !== 'number') {
          throw new Error('Model JSON malformed')
        }
        console.log('[AI_MODEL_OK]', model, { jsonMode: a1.usedJsonMode })
        return { parsed: parsed1, raw: a1.text, topic: topicHint, modelUsed: model }
      } catch {
        const a2 = await genOnceWithModel(model, basePrompt(true))
        console.log('[AI_GEN_RAW_RETRY]', { model, diff, ptype, topic: topicHint, preview: String(a2.text).slice(0, 160) })
        const json2 = extractJson(a2.text)
        const parsed2 = JSON.parse(json2) as ProblemJSON
        if (!parsed2?.problem_text || typeof parsed2.final_answer !== 'number') {
          throw new Error('Model JSON malformed (retry)')
        }
        console.log('[AI_MODEL_OK_RETRY]', model, { jsonMode: a2.usedJsonMode })
        return { parsed: parsed2, raw: a2.text, topic: topicHint, modelUsed: model }
      }
    } catch (e: any) {
      lastErr = e
      console.warn('[AI_MODEL_FAIL]', model, e?.message || String(e))
    }
  }
  throw new Error('All Gemini model candidates failed. Last error: ' + (lastErr?.message || String(lastErr)))
}

export async function POST(req: Request) {
  try {
    if (!API_KEY) throw new Error('Missing GEMINI_API_KEY')

    const body = await (async () => { try { return await req.json() } catch { return {} } })()
    const rawDiff = String((body?.difficulty ?? 'MEDIUM')).toUpperCase()
    const difficulty = (['EASY','MEDIUM','HARD'].includes(rawDiff) ? rawDiff : 'MEDIUM') as Difficulty

    const rawType = String((body?.probType ?? '')).toUpperCase()
    const probType: ProbType = (PROB_TYPES as string[]).includes(rawType) ? (rawType as ProbType) : pick(PROB_TYPES)

    // De-dupe against last problem
    const { data: last } = await supabase
      .from('math_problem_sessions')
      .select('problem_text')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let topic = pick(TOPICS)
    let gen = await generateOnce(topic, difficulty, probType)

    if (last?.problem_text && gen.parsed.problem_text.trim() === last.problem_text.trim()) {
      console.log('[AI_GEN_DEDUPE_RETRY]', { reason: 'same_as_last', topicTried: topic, model: gen.modelUsed })
      topic = pick(TOPICS, topic)
      gen = await generateOnce(topic, difficulty, probType)
    }

    // Prefix with DIFFICULTY | PROBTYPE
    const prefixed = `${difficulty} | ${probType} | ${gen.parsed.problem_text}`

    const { data: inserted, error } = await supabase
      .from('math_problem_sessions')
      .insert({
        problem_text: prefixed,
        correct_answer: gen.parsed.final_answer,
      })
      .select('id')
      .single()

    if (error) throw error

    console.log('[AI_GEN_OK]', {
      sessionId: inserted.id,
      topic: gen.topic,
      model: gen.modelUsed,
      difficulty,
      probType,
      preview: gen.parsed.problem_text.slice(0, 120),
    })

    const res = NextResponse.json({
      sessionId: inserted.id,
      difficulty,
      probType,
      problem: {
        problem_text: prefixed,
        final_answer: gen.parsed.final_answer,
      },
    })
    res.headers.set('x-generator', 'ai')
    res.headers.set('x-topic', gen.topic)
    res.headers.set('x-model', gen.modelUsed)
    res.headers.set('x-difficulty', difficulty)
    res.headers.set('x-probtype', probType)
    return res
  } catch (err: any) {
    const fb = pick(FALLBACKS)
    const difficulty: Difficulty = 'MEDIUM'
    const probType: ProbType = 'ADDITION'
    const prefixed = `${difficulty} | ${probType} | ${fb.problem_text}`

    console.warn('[AI_GEN_FALLBACK]', { error: err?.message || String(err), fallbackPreview: fb.problem_text.slice(0, 120) })
    const { data } = await supabase
      .from('math_problem_sessions')
      .insert({ problem_text: prefixed, correct_answer: fb.final_answer })
      .select('id')
      .single()

    const res = NextResponse.json({
      sessionId: data?.id,
      difficulty,
      probType,
      problem: { problem_text: prefixed, final_answer: fb.final_answer },
      note: 'Returned fallback problem due to AI error.',
    })
    res.headers.set('x-generator', 'fallback')
    res.headers.set('x-difficulty', difficulty)
    res.headers.set('x-probtype', probType)
    return res
  }
}
