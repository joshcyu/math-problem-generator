import Link from 'next/link'

export default function Landing() {
  return (
    <main className="relative isolate overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 -z-10">
        <div className="pointer-events-none absolute inset-0 opacity-[0.08]">
          {/* Floating symbols */}
          <span className="float-item left-[8%] top-[12%]">π</span>
          <span className="float-item left-[22%] top-[40%] delay-2000">×</span>
          <span className="float-item left-[35%] top-[18%] delay-500">÷</span>
          <span className="float-item left-[60%] top-[25%] delay-1000">√</span>
          <span className="float-item left-[80%] top-[15%] delay-700">%</span>
          <span className="float-item left-[12%] top-[70%] delay-1500">=</span>
          <span className="float-item left-[50%] top-[70%] delay-3000">∑</span>
          <span className="float-item left-[72%] top-[60%] delay-2500">±</span>
          <span className="float-item left-[88%] top-[45%] delay-200">∞</span>
        </div>

        {/* soft radial glow */}
        <div className="absolute inset-0 bg-gradient-to-b from-blue-50 via-white to-white" />
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 h-72 w-[48rem] rounded-full bg-blue-200/30 blur-3xl" />
      </div>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-4 py-16 sm:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-gray-900">
            Practice Math, <span className="text-blue-600">Playfully</span>.
          </h1>
          <p className="mt-5 text-lg text-gray-600">
            AI-generated Primary 5 problems with instant feedback, hints, and progress tracking.
          </p>

          <div className="mt-8 flex items-center justify-center gap-3">
            <Link
              href="/generator"
              className="btn-primary"
            >
              Let’s start solving
            </Link>
            <Link
              href="/sessions"
              className="btn-ghost"
            >
              Browse sessions
            </Link>
          </div>

          <p className="mt-6 text-xs text-gray-500">
            Tip: choose difficulty & operator once you’re in the generator.
          </p>
        </div>

        {/* Feature cards */}
        <div className="mt-14 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="card">
            <div className="card-title">💡 Smart hints</div>
            <div className="card-body">Stuck? Get just-enough guidance without giving away the answer.</div>
          </div>
          <div className="card">
            <div className="card-title">⚡ Instant feedback</div>
            <div className="card-body">Friendly, concise explanations help you learn from each attempt.</div>
          </div>
          <div className="card">
            <div className="card-title">📈 Score summary</div>
            <div className="card-body">First-try scoring by difficulty to track real mastery.</div>
          </div>
        </div>
      </section>
    </main>
  )
}
