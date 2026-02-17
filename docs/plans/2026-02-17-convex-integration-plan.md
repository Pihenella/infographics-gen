# InfographicsGen: Next.js + Convex Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate the InfographicsGen prototype into a full Next.js 15 + Convex app with persistent database, file storage, and server-side AI calls.

**Architecture:** Next.js App Router for routing and UI, Convex for backend (database, file storage, server actions). Anthropic API calls move to Convex actions so API keys stay server-side. All project/image data persists in Convex tables.

**Tech Stack:** Node.js 22 LTS, Next.js 15, Convex, TypeScript, Tailwind CSS 4, Lucide React

---

### Task 1: Install Node.js and initialize Next.js project

**Files:**
- Create: `infographics-gen/` (Next.js project scaffold)

**Step 1: Install Node.js 22 LTS via nvm**

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install 22
node --version  # Expected: v22.x.x
```

**Step 2: Create Next.js project**

```bash
cd /home/Iurii/Projects
# Remove old prototype folder first, preserve the JSX file
cp infographics-gen/infographics-gen-figma.jsx /tmp/infographics-gen-figma.jsx
cp -r infographics-gen/docs /tmp/infographics-gen-docs
rm -rf infographics-gen

npx create-next-app@latest infographics-gen \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --no-turbopack

# Restore prototype and docs
cp /tmp/infographics-gen-figma.jsx infographics-gen/infographics-gen-figma.jsx
cp -r /tmp/infographics-gen-docs infographics-gen/docs
```

**Step 3: Install dependencies**

```bash
cd /home/Iurii/Projects/infographics-gen
npm install lucide-react
```

**Step 4: Verify it runs**

```bash
cd /home/Iurii/Projects/infographics-gen
npm run build
```
Expected: Build succeeds

**Step 5: Init git and commit**

```bash
cd /home/Iurii/Projects/infographics-gen
git init
git add -A
git commit -m "feat: initialize Next.js 15 project with TypeScript and Tailwind"
```

---

### Task 2: Install and configure Convex

**Files:**
- Modify: `package.json` (add convex dep)
- Create: `convex/schema.ts`
- Modify: `src/app/layout.tsx` (add ConvexProvider)
- Create: `src/app/ConvexClientProvider.tsx`

**Step 1: Install Convex**

```bash
cd /home/Iurii/Projects/infographics-gen
npm install convex
npx convex init
```

This creates the `convex/` directory with `_generated/` and config files.

**Step 2: Create Convex schema**

Create `convex/schema.ts`:

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  projects: defineTable({
    name: v.string(),
    status: v.union(v.literal("active"), v.literal("draft")),
    referenceImageId: v.optional(v.id("_storage")),
    productImageId: v.optional(v.id("_storage")),
    styleAnalysis: v.optional(v.any()),
    createdAt: v.number(),
  }),

  generatedImages: defineTable({
    projectId: v.id("projects"),
    type: v.union(v.literal("main"), v.literal("carousel"), v.literal("rich")),
    slot: v.number(),
    prompt: v.string(),
    styleNotes: v.string(),
    suggestedText: v.string(),
    imageId: v.optional(v.id("_storage")),
    createdAt: v.number(),
  }).index("by_project", ["projectId"]),
});
```

**Step 3: Create ConvexClientProvider**

Create `src/app/ConvexClientProvider.tsx`:

```tsx
"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode } from "react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export default function ConvexClientProvider({ children }: { children: ReactNode }) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
```

**Step 4: Wrap layout with ConvexProvider**

Modify `src/app/layout.tsx` — wrap `{children}` with `<ConvexClientProvider>`:

```tsx
import ConvexClientProvider from "./ConvexClientProvider";

// In the return:
<body>
  <ConvexClientProvider>
    {children}
  </ConvexClientProvider>
</body>
```

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Convex with schema for projects and generatedImages"
```

---

### Task 3: Convex backend — projects CRUD

**Files:**
- Create: `convex/projects.ts`

**Step 1: Write projects query and mutations**

Create `convex/projects.ts`:

```typescript
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("projects").order("desc").collect();
  },
});

export const get = query({
  args: { id: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db.insert("projects", {
      name: args.name,
      status: "draft",
      createdAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("projects") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const updateStyleAnalysis = mutation({
  args: {
    id: v.id("projects"),
    styleAnalysis: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { styleAnalysis: args.styleAnalysis });
  },
});

export const setReferenceImage = mutation({
  args: {
    id: v.id("projects"),
    referenceImageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { referenceImageId: args.referenceImageId });
  },
});

export const setProductImage = mutation({
  args: {
    id: v.id("projects"),
    productImageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { productImageId: args.productImageId });
  },
});
```

**Step 2: Commit**

```bash
git add convex/projects.ts
git commit -m "feat: add Convex projects queries and mutations"
```

---

### Task 4: Convex backend — generated images + file storage

**Files:**
- Create: `convex/images.ts`

**Step 1: Write images functions**

Create `convex/images.ts`:

```typescript
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("generatedImages")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .collect();
  },
});

export const create = mutation({
  args: {
    projectId: v.id("projects"),
    type: v.union(v.literal("main"), v.literal("carousel"), v.literal("rich")),
    slot: v.number(),
    prompt: v.string(),
    styleNotes: v.string(),
    suggestedText: v.string(),
    imageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("generatedImages", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("generatedImages") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const generateUploadUrl = mutation(async (ctx) => {
  return await ctx.storage.generateUploadUrl();
});

export const getImageUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});
```

**Step 2: Commit**

```bash
git add convex/images.ts
git commit -m "feat: add Convex images queries, mutations, and file storage"
```

---

### Task 5: Convex action — Anthropic API (style analysis)

**Files:**
- Create: `convex/analyze.ts`

**Step 1: Write the Anthropic analysis action**

Create `convex/analyze.ts`:

```typescript
"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

export const analyzeReferenceStyle = action({
  args: {
    imageBase64: v.string(),
    mediaType: v.string(),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        messages: [{
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: args.mediaType,
                data: args.imageBase64,
              },
            },
            {
              type: "text",
              text: `Проанализируй эту инфографику для товара на маркетплейсе. Опиши детально:

1. Композицию и layout (расположение элементов, сетка)
2. Цветовую схему (основные и акцентные цвета, hex коды)
3. Типографику (шрифты, размеры, начертания)
4. Стиль графики (иконки, формы, иллюстрации)
5. Текстовые блоки (какие УТП, как оформлены)
6. Фоновые эффекты (градиенты, тени, текстуры)
7. Общий стиль (минимализм, максимализм, премиум и т.д.)

Верни JSON формата:
{
  "style": "краткое название стиля",
  "colors": ["#hex1", "#hex2"],
  "layout": "описание композиции",
  "typography": "описание типографики",
  "graphics": "описание графических элементов",
  "effects": "описание эффектов",
  "utp_blocks": ["УТП 1", "УТП 2"],
  "prompt_template": "детальный промпт для воссоздания этого стиля"
}`,
            },
          ],
        }],
      }),
    });

    const data = await response.json();
    const textContent = data.content?.find((item: any) => item.type === "text")?.text || "";
    const jsonMatch = textContent.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error("Failed to parse style analysis from API response");
  },
});

export const generatePrompt = action({
  args: {
    styleAnalysis: v.any(),
    projectName: v.string(),
    type: v.union(v.literal("main"), v.literal("carousel"), v.literal("rich")),
    slot: v.number(),
    utp: v.string(),
    instructions: v.string(),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

    const typeLabel = args.type === "main" ? "Главное фото" :
                      args.type === "carousel" ? `Слайд карусели #${args.slot}` :
                      "Рич-контент";

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        messages: [{
          role: "user",
          content: `Создай промпт для генерации инфографики товара, используя стиль из анализа:

Стиль референса:
${JSON.stringify(args.styleAnalysis, null, 2)}

Товар: ${args.projectName}
Тип изображения: ${typeLabel}
УТП: ${args.utp || "не указано"}
Дополнительно: ${args.instructions || "нет"}

Верни JSON:
{
  "prompt": "детальный промпт на английском",
  "negative_prompt": "что исключить",
  "style_notes": "какие ключевые элементы стиля применены",
  "suggested_text": "текст на русском для инфографики"
}`,
        }],
      }),
    });

    const data = await response.json();
    const textContent = data.content?.find((item: any) => item.type === "text")?.text || "";
    const jsonMatch = textContent.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error("Failed to parse generation prompt from API response");
  },
});
```

**Step 2: Commit**

```bash
git add convex/analyze.ts
git commit -m "feat: add Convex actions for Anthropic style analysis and prompt generation"
```

---

### Task 6: Projects list page (UI)

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Replace default page with projects list**

Rewrite `src/app/page.tsx` — port the `ProjectsList` component from the prototype, replacing `useState` with Convex queries:

```tsx
"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useRouter } from "next/navigation";
import { Plus, Image } from "lucide-react";

export default function ProjectsPage() {
  const projects = useQuery(api.projects.list);
  const createProject = useMutation(api.projects.create);
  const router = useRouter();

  const handleCreate = async () => {
    const id = await createProject({ name: "Новый товар" });
    router.push(`/project/${id}`);
  };

  if (!projects) return <div className="h-screen flex items-center justify-center">Загрузка...</div>;

  return (
    <div className="h-screen flex flex-col bg-white">
      <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <span className="text-white font-bold text-sm">IG</span>
          </div>
          <h1 className="text-lg font-semibold text-gray-900">InfographicsGen</h1>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Новый проект
        </button>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-7xl">
          {projects.map((project) => (
            <div
              key={project._id}
              onClick={() => router.push(`/project/${project._id}`)}
              className="border border-gray-200 rounded-lg p-4 hover:border-blue-500 hover:shadow-sm transition-all cursor-pointer bg-white"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">{project.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    project.status === "active"
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-600"
                  }`}>
                    {project.status === "active" ? "Активный" : "Черновик"}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 text-sm text-gray-600">
                <Image className="w-4 h-4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Verify build**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add projects list page with Convex queries"
```

---

### Task 7: Generator page (UI)

**Files:**
- Create: `src/app/project/[id]/page.tsx`

**Step 1: Create generator page**

Port the `GeneratorView` from the prototype. This is the main page — reference upload, product upload, generation settings, results. Use Convex mutations for file uploads, actions for AI analysis, queries for generated images.

Key integrations:
- File upload: `generateUploadUrl` mutation → fetch POST to upload URL → `setReferenceImage`/`setProductImage` mutation
- Style analysis: `analyzeReferenceStyle` action → `updateStyleAnalysis` mutation
- Generation: `generatePrompt` action → `images.create` mutation
- Display: `useQuery(api.images.listByProject)` for results

The full component code follows the prototype's `GeneratorView` structure but replaces all `useState` with Convex hooks.

Create `src/app/project/[id]/page.tsx` with the full generator view (port from prototype lines 274-605, adapting to Convex).

**Step 2: Verify build**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add src/app/project/
git commit -m "feat: add generator page with Convex file upload and AI analysis"
```

---

### Task 8: Deploy Convex and test end-to-end

**Step 1: Deploy Convex backend**

```bash
cd /home/Iurii/Projects/infographics-gen
npx convex dev
```

This will prompt to create a Convex project and set `NEXT_PUBLIC_CONVEX_URL` in `.env.local`.

**Step 2: Set Anthropic API key**

```bash
npx convex env set ANTHROPIC_API_KEY <your-key>
```

**Step 3: Run Next.js dev server in another terminal**

```bash
npm run dev
```

**Step 4: Test manually**
1. Open http://localhost:3000
2. Create a project
3. Upload reference image → verify style analysis runs
4. Upload product image
5. Generate → verify prompt generation works
6. Check Convex dashboard for stored data

**Step 5: Commit any fixes**

```bash
git add -A
git commit -m "feat: complete Convex integration with end-to-end functionality"
```
