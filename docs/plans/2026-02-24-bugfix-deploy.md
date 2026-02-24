# Bugfix & Deploy Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 3 code bugs so the app builds successfully on Vercel and all AI features work.

**Architecture:** Three targeted one-file fixes — build-resilient Convex provider init, updated Claude model ID, corrected Vertex AI background removal API format — then push to GitHub.

**Tech Stack:** Next.js 16, Convex, Anthropic API (claude-sonnet-4-6), Vertex AI Imagen 3/4

---

### Task 1: Fix ConvexClientProvider — build crash without env var

**Files:**
- Modify: `src/app/ConvexClientProvider.tsx`

**Context:**
`ConvexReactClient` is instantiated at module level. During Next.js pre-rendering on Vercel (when `NEXT_PUBLIC_CONVEX_URL` is not set), this throws `Error: No address provided to ConvexReactClient` and aborts the build. The fix: conditional module-level init.

**Step 1: Read the current file**

Open `src/app/ConvexClientProvider.tsx`. Current content:
```typescript
"use client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode } from "react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export default function ConvexClientProvider({ children }: { children: ReactNode }) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
```

**Step 2: Replace with build-resilient version**

Replace the entire file content with:
```typescript
"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode } from "react";

const address = process.env.NEXT_PUBLIC_CONVEX_URL;
const convex = address ? new ConvexReactClient(address) : null;

export default function ConvexClientProvider({ children }: { children: ReactNode }) {
  if (!convex) return <>{children}</>;
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
```

**Step 3: Verify build succeeds without env var**

Run:
```bash
npm run build
```
Expected output (no error):
```
Route (app)
┌ ○ /
├ ○ /_not-found
└ ƒ /project/[id]
```
If you see `Error: No address provided to ConvexReactClient` — the file wasn't saved correctly.

**Step 4: Verify build also succeeds WITH env var**

Run:
```bash
NEXT_PUBLIC_CONVEX_URL=https://placeholder.convex.cloud npm run build
```
Expected: same clean output as Step 3.

**Step 5: Commit**

```bash
git add src/app/ConvexClientProvider.tsx
git commit -m "fix: make Convex client init resilient to missing env var at build time"
```

---

### Task 2: Fix Claude model ID in analyze.ts

**Files:**
- Modify: `convex/analyze.ts`

**Context:**
Two calls to Anthropic API use model ID `claude-sonnet-4-20250514` (May 2025 release). The current production model ID is `claude-sonnet-4-6`. Outdated IDs may be deprecated or produce errors.

**Step 1: Update model ID in analyzeReferenceStyle (line ~24)**

In `convex/analyze.ts`, find:
```
model: "claude-sonnet-4-20250514",
```
Replace both occurrences (there are two — one in `analyzeReferenceStyle`, one in `generatePrompt`) with:
```
model: "claude-sonnet-4-6",
```

Verify: search the file to confirm no occurrence of `claude-sonnet-4-20250514` remains.

**Step 2: Commit**

```bash
git add convex/analyze.ts
git commit -m "fix: update Claude model ID to claude-sonnet-4-6"
```

---

### Task 3: Fix Vertex AI background removal API format

**Files:**
- Modify: `convex/imagen.ts`

**Context:**
The `removeBackground` action sends `editMode: "product-image"` which is a product-photo generation mode, NOT background removal. The design doc specifies `editConfig: { backgroundRemovalConfig: {} }` which is the correct Vertex AI Imagen 3 background removal format. The `prompt: ""` field in instances should also be removed (not needed for this operation).

**Step 1: Read current removeBackground handler in convex/imagen.ts**

Current body:
```typescript
body: JSON.stringify({
  instances: [
    {
      prompt: "",
      image: { bytesBase64Encoded: args.imageBase64 },
    },
  ],
  parameters: {
    editMode: "product-image",
    sampleCount: 1,
  },
}),
```

**Step 2: Replace with correct background removal format**

Replace the `body: JSON.stringify(...)` block inside `removeBackground` with:
```typescript
body: JSON.stringify({
  instances: [
    {
      image: { bytesBase64Encoded: args.imageBase64 },
    },
  ],
  parameters: {
    sampleCount: 1,
    editConfig: { backgroundRemovalConfig: {} },
  },
}),
```

**Step 3: Verify the rest of the file is unchanged**

Run:
```bash
npm run build
```
Expected: same clean build output as Task 1.

**Step 4: Commit**

```bash
git add convex/imagen.ts
git commit -m "fix: use correct Vertex AI backgroundRemovalConfig API format"
```

---

### Task 4: Push to GitHub and guide Vercel redeploy

**Step 1: Push all commits**

```bash
git push origin master
```
Expected: commits pushed, GitHub shows the 3 new commits.

**Step 2: Trigger Vercel redeploy**

Go to https://vercel.com/dashboard → find `infographics-gen` project → Deployments tab → click "Redeploy" on the latest deployment.

OR: if Vercel auto-deploys on push, just wait ~2 minutes for the build to complete.

**Step 3: Set NEXT_PUBLIC_CONVEX_URL in Vercel**

1. Open Vercel project → Settings → Environment Variables
2. Add: `NEXT_PUBLIC_CONVEX_URL` = your Convex deployment URL
   - Find it in: [Convex Dashboard](https://dashboard.convex.dev) → your project → Settings → Deployment URL
   - Format: `https://XXXXX.convex.cloud`
3. After adding the variable, **trigger a new deploy** (env var only takes effect after rebuild)

**Step 4: Set secrets in Convex Dashboard**

1. Open [Convex Dashboard](https://dashboard.convex.dev) → your project → Settings → Environment Variables
2. Add `ANTHROPIC_API_KEY` = your Anthropic API key (from https://console.anthropic.com)
3. Add `GOOGLE_SERVICE_ACCOUNT_JSON` = the full JSON string of your Google Cloud service account (the one with Vertex AI access)

**Step 5: Verify the app loads**

Open https://infographics-gen.vercel.app — should show the InfographicsGen dashboard (not 404).

---

## Env Vars Checklist

| Variable | Where to set | Value source |
|----------|-------------|--------------|
| `NEXT_PUBLIC_CONVEX_URL` | Vercel → Settings → Env Vars | Convex Dashboard → Settings → URL |
| `ANTHROPIC_API_KEY` | Convex Dashboard → Env Vars | console.anthropic.com → API Keys |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Convex Dashboard → Env Vars | Google Cloud Console → Service Accounts → JSON key |
