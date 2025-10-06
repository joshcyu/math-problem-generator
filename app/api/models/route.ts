// app/api/models/route.ts
export const runtime = 'nodejs'
export async function GET() {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${process.env.GEMINI_API_KEY}`)
  const j = await r.json()
  return new Response(JSON.stringify(j, null, 2), { headers: { 'content-type': 'application/json' }})
}
