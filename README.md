# Math Problem Generator - Developer Assessment Starter Kit

## Overview

This is a starter kit for building an AI-powered math problem generator application. The goal is to create a standalone prototype that uses AI to generate math word problems suitable for Primary 5 students, saves the problems and user submissions to a database, and provides personalized feedback.

## Tech Stack

- **Frontend Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: Supabase
- **AI Integration**: Google Generative AI (Gemini)

## Setup Instructions

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd math-problem-generator
```

### 2. Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and create a free account
2. Create a new project
3. Go to Settings → API to find your:
   - Project URL (starts with `https://`)
   - Anon/Public Key

### 3. Set Up Database Tables

1. In your Supabase dashboard, go to SQL Editor
2. Copy and paste the contents of `database.sql`
3. Click "Run" to create the tables and policies

### 4. Get Google API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key for Gemini

### 5. Configure Environment Variables

1. Copy `.env.local.example` to `.env.local`:
   ```bash
   cp .env.local.example .env.local
   ```
2. Edit `.env.local` and add your actual keys:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_actual_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_actual_supabase_anon_key
   GOOGLE_API_KEY=your_actual_google_api_key
   ```

### 6. Install Dependencies

```bash
npm install
```

### 7. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Your Task

### 1. Implement Frontend Logic (`app/page.tsx`)

Complete the TODO sections in the main page component:

- **generateProblem**: Call your API route to generate a new math problem
- **submitAnswer**: Submit the user's answer and get feedback

### 2. Create Backend API Route (`app/api/math-problem/route.ts`)

Create a new API route that handles:

#### POST /api/math-problem (Generate Problem)
- Use Google's Gemini AI to generate a math word problem
- The AI should return JSON with:
  ```json
  {
    "problem_text": "A bakery sold 45 cupcakes...",
    "final_answer": 15
  }
  ```
- Save the problem to `math_problem_sessions` table
- Return the problem and session ID to the frontend

#### POST /api/math-problem/submit (Submit Answer)
- Receive the session ID and user's answer
- Check if the answer is correct
- Use AI to generate personalized feedback based on:
  - The original problem
  - The correct answer
  - The user's answer
  - Whether they got it right or wrong
- Save the submission to `math_problem_submissions` table
- Return the feedback and correctness to the frontend

### 3. Requirements Checklist

- [/] AI generates appropriate Primary 5 level math problems
- [/] Problems and answers are saved to Supabase
- [/] User submissions are saved with feedback
- [/] AI generates helpful, personalized feedback
- [/] UI is clean and mobile-responsive
- [/] Error handling for API failures
- [/] Loading states during API calls

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Go to [Vercel](https://vercel.com) and import your repository
3. Add your environment variables in Vercel's project settings
4. Deploy!

## Assessment Submission

When submitting your assessment, provide:

1. **GitHub Repository URL**: Make sure it's public
2. **Live Demo URL**: Your Vercel deployment
3. **Supabase Credentials**: Add these to your README for testing:
   ```
   SUPABASE_URL: https://akfapffrmgnvwlpvulzn.supabase.co
   SUPABASE_ANON_KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFrZmFwZmZybWdudndscHZ1bHpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2NjY5ODEsImV4cCI6MjA3NTI0Mjk4MX0.BjY1o28tNvNrG9UNsE10ToZUQSsxwCsAT_ZUqbgCFTU
   ```

## Implementation Notes

*Please fill in this section with any important notes about your implementation, design decisions, challenges faced, or features you're particularly proud of.*

## My Implementation

Schema constraint & workaround (important): Per the brief, I did not modify the database schema (doing so might deduct points). Since there are no dedicated columns for difficulty and problem type, I store them as a prefix in problem_text:
MEDIUM | MULTIPLICATION | <actual problem text…>
All UI/analytics (scoreboard, filters, history) parse these from the prefix. The parser is robust to BOM/zero-width characters, whitespace, and mixed case.

AI problem generation: /api/generate calls Gemini (with fallbacks) and persists a session with problem_text (including the prefix) and correct_answer. It de-dupes against the most recent problem to avoid exact repeats.

Answer parsing: Users can submit integers, decimals, simple fractions, or mixed numbers (e.g., 1 1/2). Fractions are normalized to a number for comparison; I keep a small epsilon for floating-point equality.

AI feedback: /api/submit classifies the outcome as correct, near, or wrong, then asks Gemini for concise, kind feedback (with deterministic fallback text if AI fails). Feedback plus correctness are saved to math_problem_submissions.

First-try scoring: /api/score reads only the earliest submission per session to compute “first-try” accuracy, plus a by-difficulty breakdown (again parsed from the prefix).

Hints: /api/hint returns a short, encouraging nudge tailored to the current session.

UI/UX polish:

Generator page has an animated loading overlay (floating math glyphs), card “throw” animations for next/prev, and a progress-bar scoreboard.

Mobile drawer navbar with scroll-lock and backdrop.

Sessions list supports filter by difficulty and inline answering.

History and Session detail pages show submissions + AI feedback.

Performance notes: Scoreboard data is fetched on mount and after a submit, not during hint/generate actions. Problem cards are rendered one at a time with lightweight animations.

Security & environment: Uses Supabase anon keys only (as allowed); no user accounts. Gemini key is server-side. No schema changes.

Assessment visibility: Because there’s no user system, testing rows are visible in the interface (aligned with the provided guidelines).

## Additional Features (Optional)

If you have time, consider adding:

- [/] Difficulty levels (Easy/Medium/Hard)
- [/] Problem history view
- [/] Score tracking
- [/] Different problem types (addition, subtraction, multiplication, division)
- [/] Hints system
- [/] Step-by-step solution explanations

---

Good luck with your assessment! 🎯
