# Bugfix & Deploy Design — InfographicsGen
Date: 2026-02-24

## Problem

The deployed app at infographics-gen.vercel.app returns 404 on all routes because the Vercel build fails. Root cause: `ConvexClientProvider.tsx` instantiates `ConvexReactClient` at module level — when `NEXT_PUBLIC_CONVEX_URL` is absent at build time, Next.js pre-rendering crashes and exits with code 1.

Two additional code bugs were found:
1. `convex/analyze.ts` uses deprecated Claude model ID `claude-sonnet-4-20250514`
2. `convex/imagen.ts` removeBackground uses wrong Vertex AI API format (`editMode: "product-image"` instead of `backgroundRemovalConfig`)

## Fixes

### Fix 1 — ConvexClientProvider.tsx
Move from module-level unconditional init to conditional init:
```typescript
const address = process.env.NEXT_PUBLIC_CONVEX_URL;
const convex = address ? new ConvexReactClient(address) : null;

export default function ConvexClientProvider({ children }) {
  if (!convex) return <>{children}</>;
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
```
**Effect:** Build always succeeds. With env var set on Vercel, app works fully.

### Fix 2 — convex/analyze.ts
Change model ID: `claude-sonnet-4-20250514` → `claude-sonnet-4-6` (both occurrences).

### Fix 3 — convex/imagen.ts
Change removeBackground request body to match design-doc spec:
```json
{
  "instances": [{"image": {"bytesBase64Encoded": "..."}}],
  "parameters": {
    "sampleCount": 1,
    "editConfig": {"backgroundRemovalConfig": {}}
  }
}
```

## Deployment Steps (user action required)
After pushing fixes, the user must:
1. **Vercel** → Settings → Environment Variables → add `NEXT_PUBLIC_CONVEX_URL` (from Convex Dashboard → Settings → URL)
2. **Convex Dashboard** → Settings → Environment Variables → add `ANTHROPIC_API_KEY` and `GOOGLE_SERVICE_ACCOUNT_JSON`
3. Vercel will auto-redeploy; or trigger manually via "Redeploy"
