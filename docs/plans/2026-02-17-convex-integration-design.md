# Convex Integration Design — InfographicsGen

## Overview
Migrate InfographicsGen from a stateless JSX prototype to a full Next.js 15 + Convex app with persistent storage, file uploads, and server-side API calls.

## Stack
- Next.js 15 (App Router)
- Convex (database + file storage + server actions)
- Tailwind CSS
- Lucide React

## Convex Schema

### projects
- `name: string`
- `status: "active" | "draft"`
- `referenceImageId?: Id<"_storage">` (Convex File Storage)
- `productImageId?: Id<"_storage">`
- `styleAnalysis?: object`
- `createdAt: number`

### generatedImages
- `projectId: Id<"projects">`
- `type: "main" | "carousel" | "rich"`
- `slot: number`
- `prompt: string`
- `styleNotes: string`
- `suggestedText: string`
- `imageId?: Id<"_storage">`
- `createdAt: number`

## Project Structure
```
infographics-gen/
├── convex/
│   ├── schema.ts
│   ├── projects.ts
│   ├── images.ts
│   └── _generated/
├── src/app/
│   ├── layout.tsx          # ConvexProvider
│   ├── page.tsx            # Projects list
│   └── project/[id]/
│       └── page.tsx        # Generator view
├── src/components/
│   ├── ProjectsList.tsx
│   ├── GeneratorView.tsx
│   ├── ReferenceUpload.tsx
│   ├── ProductUpload.tsx
│   ├── GenerationSettings.tsx
│   └── GeneratedImageCard.tsx
```

## Key Changes from Current Code
1. `useState` arrays -> Convex `useQuery`/`useMutation`
2. Base64 file handling -> Convex File Storage
3. Client-side Anthropic API calls -> Convex actions (API key stays server-side)
4. Single-component SPA -> Next.js pages with routing
