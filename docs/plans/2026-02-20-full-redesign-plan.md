# Full Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Google Sheets TZ import, Vertex AI Imagen 4 Ultra image generation, Fabric.js canvas editor with editable text, carousel slide count selector with per-slide photos, and background removal tool.

**Architecture:** Convex actions handle all external API calls (Vertex AI Imagen, Google Sheets CSV fetch) server-side. The project page is fully redesigned with a left control panel and right Fabric.js canvas editor. Text block positions come from Anthropic's `generatePrompt` response and are rendered as editable `fabric.IText` objects on the canvas.

**Tech Stack:** Next.js 15, Convex, Fabric.js v6, google-auth-library, Anthropic Claude, Vertex AI Imagen 4 Ultra

---

## Task 1: Install dependencies

**Files:**
- Modify: `package.json` (via npm)

**Step 1: Install runtime packages**

```bash
cd /home/Iurii/Projects/infographics-gen
npm install fabric google-auth-library
```

Expected: both packages appear in `package.json` dependencies.

**Step 2: Verify imports resolve**

```bash
node -e "require('google-auth-library'); console.log('ok')"
```

Expected: prints `ok`

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add fabric and google-auth-library"
```

---

## Task 2: Update Convex schema

**Files:**
- Modify: `convex/schema.ts`

**Step 1: Replace schema.ts with updated version**

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
    sheetsUrl: v.optional(v.string()),
    sheetsData: v.optional(v.any()),
    carouselCount: v.optional(v.number()),
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
    textLayers: v.optional(v.any()),
    slideProductImageId: v.optional(v.id("_storage")),
    createdAt: v.number(),
  }).index("by_project", ["projectId"]),
});
```

**Step 2: Verify Convex regenerates types**

```bash
npx convex dev --once
```

Expected: no errors, `convex/_generated/` files updated.

**Step 3: Commit**

```bash
git add convex/schema.ts convex/_generated/
git commit -m "feat: extend schema with sheetsData, carouselCount, textLayers"
```

---

## Task 3: Add new mutations to convex/projects.ts

**Files:**
- Modify: `convex/projects.ts`

**Step 1: Append these mutations at the end of convex/projects.ts**

```typescript
export const updateSheetsData = mutation({
  args: {
    id: v.id("projects"),
    sheetsUrl: v.string(),
    sheetsData: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      sheetsUrl: args.sheetsUrl,
      sheetsData: args.sheetsData,
    });
  },
});

export const updateCarouselCount = mutation({
  args: {
    id: v.id("projects"),
    carouselCount: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { carouselCount: args.carouselCount });
  },
});
```

**Step 2: Run convex dev once to check**

```bash
npx convex dev --once
```

Expected: no errors.

**Step 3: Commit**

```bash
git add convex/projects.ts convex/_generated/
git commit -m "feat: add updateSheetsData and updateCarouselCount mutations"
```

---

## Task 4: Add new mutations to convex/images.ts

**Files:**
- Modify: `convex/images.ts`

**Step 1: Update `create` mutation to accept new fields, add `updateImageData` mutation**

Replace the existing `create` mutation and add `updateImageData`:

```typescript
export const create = mutation({
  args: {
    projectId: v.id("projects"),
    type: v.union(v.literal("main"), v.literal("carousel"), v.literal("rich")),
    slot: v.number(),
    prompt: v.string(),
    styleNotes: v.string(),
    suggestedText: v.string(),
    imageId: v.optional(v.id("_storage")),
    textLayers: v.optional(v.any()),
    slideProductImageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("generatedImages", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const updateImageData = mutation({
  args: {
    id: v.id("generatedImages"),
    imageId: v.optional(v.id("_storage")),
    textLayers: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const { id, ...patch } = args;
    await ctx.db.patch(id, patch);
  },
});

export const setSlideProductImage = mutation({
  args: {
    id: v.id("generatedImages"),
    slideProductImageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      slideProductImageId: args.slideProductImageId,
    });
  },
});
```

**Step 2: Verify**

```bash
npx convex dev --once
```

**Step 3: Commit**

```bash
git add convex/images.ts convex/_generated/
git commit -m "feat: add updateImageData and setSlideProductImage mutations"
```

---

## Task 5: Create convex/sheets.ts — Google Sheets parser

**Files:**
- Create: `convex/sheets.ts`

**Step 1: Create the file**

```typescript
"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

export type SlideData = {
  slide: number;
  heading: string;
  texts: string[];
  notes: string;
};

export const fetchAndParse = action({
  args: { url: v.string() },
  handler: async (_ctx, args): Promise<SlideData[]> => {
    const spreadsheetIdMatch = args.url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!spreadsheetIdMatch) throw new Error("Invalid Google Sheets URL");

    const spreadsheetId = spreadsheetIdMatch[1];
    const gidMatch = args.url.match(/[#&]gid=(\d+)/);
    const gid = gidMatch ? gidMatch[1] : "0";

    const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;

    const response = await fetch(csvUrl, { redirect: "follow" });
    if (!response.ok) {
      throw new Error(
        "Не удалось загрузить таблицу. Убедитесь что доступ открыт (Все у кого есть ссылка)"
      );
    }

    const csvText = await response.text();
    return parseSlides(csvText);
  },
});

function parseSlides(csv: string): SlideData[] {
  const lines = csv
    .split("\n")
    .map((line) =>
      line
        .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
        .map((cell) => cell.replace(/^"|"$/g, "").trim())
    );

  const slides: SlideData[] = [];
  let current: SlideData | null = null;

  for (const row of lines) {
    if (row.every((cell) => !cell)) continue;

    const slideMatch = row[0]?.match(/^(\d+)\s*(?:слайд|slide)/i);
    if (slideMatch) {
      if (current) slides.push(current);
      current = {
        slide: parseInt(slideMatch[1]),
        heading: row[1] || row[0],
        texts: [],
        notes: row[3] || "",
      };
    } else if (current) {
      if (row[1]) current.texts.push(row[1]);
      if (row[3]) current.notes += (current.notes ? " " : "") + row[3];
    }
  }

  if (current) slides.push(current);
  return slides;
}
```

**Step 2: Run convex dev**

```bash
npx convex dev --once
```

Expected: no errors.

**Step 3: Manually test via Convex dashboard**
Open the Convex dashboard → Functions → sheets:fetchAndParse → run with `{ url: "https://docs.google.com/spreadsheets/d/1i9X2cX37YAFEGVQZVnWMCH-PFgXBxrid4V6yQLGEEww/edit?gid=2099865332#gid=2099865332" }`.
Expected: array of slide objects with slide number, heading, texts, notes.

**Step 4: Commit**

```bash
git add convex/sheets.ts convex/_generated/
git commit -m "feat: add Google Sheets CSV parser action"
```

---

## Task 6: Create convex/imagen.ts — Vertex AI Imagen

**Files:**
- Create: `convex/imagen.ts`

**Step 1: Create the file**

```typescript
"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { GoogleAuth } from "google-auth-library";

async function getAccessToken(): Promise<{ token: string; projectId: string }> {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!json) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not set");

  const credentials = JSON.parse(json);
  const auth = new GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  if (!tokenResponse.token) throw new Error("Failed to get access token");

  return { token: tokenResponse.token, projectId: credentials.project_id };
}

export const generateImage = action({
  args: { prompt: v.string() },
  handler: async (_ctx, args): Promise<string> => {
    const { token, projectId } = await getAccessToken();

    const url = `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/imagen-4.0-ultra-generate-001:predict`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        instances: [{ prompt: args.prompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio: "1:1",
        },
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || "Imagen API error");
    }

    const base64 = data.predictions?.[0]?.bytesBase64Encoded;
    if (!base64) throw new Error("No image in Imagen response");
    return base64;
  },
});

export const removeBackground = action({
  args: { imageBase64: v.string() },
  handler: async (_ctx, args): Promise<string> => {
    const { token, projectId } = await getAccessToken();

    const url = `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/imagen-3.0-capability-001:predict`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
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
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || "Background removal error");
    }

    const base64 = data.predictions?.[0]?.bytesBase64Encoded;
    if (!base64) throw new Error("No image in background removal response");
    return base64;
  },
});
```

**Step 2: Add GOOGLE_SERVICE_ACCOUNT_JSON to Convex environment**

```bash
npx convex env set GOOGLE_SERVICE_ACCOUNT_JSON "$(cat /path/to/your/service-account.json)"
```

> Replace `/path/to/your/service-account.json` with the actual path.

**Step 3: Run convex dev**

```bash
npx convex dev --once
```

Expected: no errors.

**Step 4: Commit**

```bash
git add convex/imagen.ts convex/_generated/
git commit -m "feat: add Vertex AI Imagen generate and removeBackground actions"
```

---

## Task 7: Update convex/analyze.ts — add slideData and textBlocks

**Files:**
- Modify: `convex/analyze.ts`

**Step 1: Update `generatePrompt` to accept slideData and return textBlocks**

Replace the entire `generatePrompt` action handler body:

```typescript
export const generatePrompt = action({
  args: {
    styleAnalysis: v.any(),
    projectName: v.string(),
    type: v.union(v.literal("main"), v.literal("carousel"), v.literal("rich")),
    slot: v.number(),
    utp: v.string(),
    instructions: v.string(),
    slideData: v.optional(v.any()),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

    const typeLabel =
      args.type === "main"
        ? "Главное фото"
        : args.type === "carousel"
          ? `Слайд карусели #${args.slot}`
          : "Рич-контент";

    const slideContext = args.slideData
      ? `
Данные из ТЗ для этого слайда:
Заголовок: ${args.slideData.heading}
Тексты: ${args.slideData.texts?.join(", ")}
Дизайн-комментарии: ${args.slideData.notes}
`
      : "";

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
        messages: [
          {
            role: "user",
            content: `Создай промпт для генерации инфографики товара, используя стиль из анализа.

Стиль референса:
${JSON.stringify(args.styleAnalysis, null, 2)}

Товар: ${args.projectName}
Тип изображения: ${typeLabel}
УТП: ${args.utp || "не указано"}
Дополнительно: ${args.instructions || "нет"}
${slideContext}

Верни JSON (без markdown):
{
  "prompt": "детальный промпт на английском для Imagen 4 Ultra",
  "negative_prompt": "что исключить",
  "style_notes": "какие ключевые элементы стиля применены",
  "suggested_text": "весь текст на русском для инфографики",
  "textBlocks": [
    { "text": "текст блока", "x": 50, "y": 80, "fontSize": 32, "fontFamily": "Inter", "fontWeight": "bold", "color": "#ffffff" }
  ]
}

textBlocks — позиции текста на холсте 1000x1000px. Размести 3-6 блоков в логичных местах исходя из типа инфографики.`,
          },
        ],
      }),
    });

    const data = await response.json();
    const textContent =
      data.content?.find((item: { type: string }) => item.type === "text")
        ?.text || "";
    const jsonMatch = textContent.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error("Failed to parse generation prompt from API response");
  },
});
```

**Step 2: Run convex dev**

```bash
npx convex dev --once
```

**Step 3: Commit**

```bash
git add convex/analyze.ts convex/_generated/
git commit -m "feat: add slideData param and textBlocks output to generatePrompt"
```

---

## Task 8: Create SheetsImport component

**Files:**
- Create: `src/app/project/[id]/SheetsImport.tsx`

**Step 1: Create the file**

```tsx
"use client";

import { useState } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { Link, RefreshCw, CheckCircle, AlertCircle } from "lucide-react";

type Props = {
  projectId: Id<"projects">;
  currentUrl?: string;
  slidesCount?: number;
};

export function SheetsImport({ projectId, currentUrl, slidesCount }: Props) {
  const [url, setUrl] = useState(currentUrl || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAndParse = useAction(api.sheets.fetchAndParse);
  const updateSheetsData = useMutation(api.projects.updateSheetsData);

  const handleLoad = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const slides = await fetchAndParse({ url: url.trim() });
      await updateSheetsData({ id: projectId, sheetsUrl: url.trim(), sheetsData: slides });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
        Источник ТЗ (Google Sheets)
      </label>
      <div className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://docs.google.com/spreadsheets/..."
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleLoad}
          disabled={loading || !url.trim()}
          className="px-3 py-2 bg-blue-600 text-white rounded-md text-xs font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
        >
          {loading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Link className="w-3 h-3" />}
          {loading ? "..." : "Загрузить"}
        </button>
      </div>

      {error && (
        <div className="mt-2 flex items-start gap-1.5 text-xs text-red-600 bg-red-50 p-2 rounded">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {!error && slidesCount != null && slidesCount > 0 && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-green-700 bg-green-50 p-2 rounded">
          <CheckCircle className="w-3.5 h-3.5" />
          {slidesCount} слайдов загружено из таблицы
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/project/[id]/SheetsImport.tsx
git commit -m "feat: add SheetsImport component"
```

---

## Task 9: Create BgRemover component

**Files:**
- Create: `src/app/project/[id]/BgRemover.tsx`

**Step 1: Create the file**

```tsx
"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Scissors, RefreshCw, Download, Upload } from "lucide-react";

export function BgRemover() {
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [resultBase64, setResultBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const removeBackground = useAction(api.imagen.removeBackground);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setPreview(dataUrl);
      setImageBase64(dataUrl.split(",")[1]);
      setResultBase64(null);
    };
    reader.readAsDataURL(file);
  };

  const handleRemove = async () => {
    if (!imageBase64) return;
    setLoading(true);
    setError(null);
    try {
      const result = await removeBackground({ imageBase64 });
      setResultBase64(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка удаления фона");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!resultBase64) return;
    const link = document.createElement("a");
    link.href = `data:image/png;base64,${resultBase64}`;
    link.download = "no-bg.png";
    link.click();
  };

  return (
    <div className="border-t border-gray-200 pt-4 mt-2">
      <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
        Очистить фон
      </label>

      {!preview ? (
        <label className="block border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all">
          <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
          <Upload className="w-6 h-6 text-gray-400 mx-auto mb-1" />
          <p className="text-xs text-gray-500">Загрузить фото</p>
        </label>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-xs text-gray-500 mb-1">Исходное</p>
              <img src={preview} className="w-full rounded border border-gray-200 bg-gray-50" />
            </div>
            {resultBase64 && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Результат</p>
                <img
                  src={`data:image/png;base64,${resultBase64}`}
                  className="w-full rounded border border-gray-200"
                  style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10'%3E%3Crect width='5' height='5' fill='%23ccc'/%3E%3Crect x='5' y='5' width='5' height='5' fill='%23ccc'/%3E%3C/svg%3E\")" }}
                />
              </div>
            )}
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 p-2 rounded">{error}</p>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleRemove}
              disabled={loading}
              className="flex-1 py-2 bg-purple-600 text-white rounded-md text-xs font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {loading ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                <Scissors className="w-3 h-3" />
              )}
              {loading ? "Обрабатываю..." : "Убрать фон"}
            </button>
            {resultBase64 && (
              <button
                onClick={handleDownload}
                className="px-3 py-2 border border-gray-300 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-1"
              >
                <Download className="w-3 h-3" />
                PNG
              </button>
            )}
          </div>

          <button
            onClick={() => { setPreview(null); setImageBase64(null); setResultBase64(null); }}
            className="w-full text-xs text-gray-500 hover:text-gray-700"
          >
            Загрузить другое
          </button>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/project/[id]/BgRemover.tsx
git commit -m "feat: add BgRemover component"
```

---

## Task 10: Create CarouselSettings component

**Files:**
- Create: `src/app/project/[id]/CarouselSettings.tsx`

**Step 1: Create the file**

```tsx
"use client";

import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { Image } from "lucide-react";

type Props = {
  projectId: Id<"projects">;
  carouselCount: number;
  onCountChange: (n: number) => void;
  slideProductImages: Record<number, string | null>;
  onSlideImageUpload: (slot: number, base64: string, file: File) => void;
};

const SLOT_OPTIONS = [2, 3, 4, 5, 6, 7, 8, 9, 10];

export function CarouselSettings({
  projectId,
  carouselCount,
  onCountChange,
  slideProductImages,
  onSlideImageUpload,
}: Props) {
  const updateCarouselCount = useMutation(api.projects.updateCarouselCount);
  const generateUploadUrl = useMutation(api.images.generateUploadUrl);

  const handleCountChange = async (n: number) => {
    onCountChange(n);
    await updateCarouselCount({ id: projectId, carouselCount: n });
  };

  const handleSlideImage = (slot: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      onSlideImageUpload(slot, dataUrl, file);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div>
      <div className="mb-3">
        <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
          Количество слайдов
        </label>
        <div className="flex flex-wrap gap-1.5">
          {SLOT_OPTIONS.map((n) => (
            <button
              key={n}
              onClick={() => handleCountChange(n)}
              className={`w-8 h-8 rounded-md text-xs font-medium border transition-all ${
                carouselCount === n
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-200 text-gray-700 hover:border-gray-300"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {Array.from({ length: carouselCount }, (_, i) => i + 1).map((slot) => (
          <div key={slot} className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-14 flex-shrink-0">Слайд {slot}</span>
            <label className="flex-1 flex items-center gap-1.5 border border-dashed border-gray-300 rounded px-2 py-1.5 cursor-pointer hover:border-blue-400 transition-colors">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleSlideImage(slot, e)}
                className="hidden"
              />
              {slideProductImages[slot] ? (
                <img
                  src={slideProductImages[slot]!}
                  className="w-8 h-8 object-contain rounded"
                />
              ) : (
                <Image className="w-4 h-4 text-gray-400" />
              )}
              <span className="text-xs text-gray-500">
                {slideProductImages[slot] ? "Заменить" : "Фото (опц.)"}
              </span>
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/project/[id]/CarouselSettings.tsx
git commit -m "feat: add CarouselSettings component with per-slide photo upload"
```

---

## Task 11: Create CanvasEditor component

**Files:**
- Create: `src/app/project/[id]/CanvasEditor.tsx`

> Note: Fabric.js requires the DOM — this component must be loaded with `dynamic(() => import(...), { ssr: false })`.

**Step 1: Create the file**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import * as fabric from "fabric";
import { Download, Bold, Italic } from "lucide-react";

type TextBlock = {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  fontWeight?: string;
  color?: string;
};

type Props = {
  imageBase64: string | null;
  textBlocks: TextBlock[];
  onSaveTextLayers?: (json: object) => void;
};

const CANVAS_SIZE = 1000;

export default function CanvasEditor({ imageBase64, textBlocks, onSaveTextLayers }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const [selectedText, setSelectedText] = useState<fabric.IText | null>(null);
  const [fontSize, setFontSize] = useState(24);
  const [fontFamily, setFontFamily] = useState("Inter");
  const [textColor, setTextColor] = useState("#ffffff");

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new fabric.Canvas(canvasRef.current, {
      width: CANVAS_SIZE,
      height: CANVAS_SIZE,
    });
    fabricRef.current = canvas;

    canvas.on("selection:created", (e) => {
      const obj = e.selected?.[0];
      if (obj instanceof fabric.IText) {
        setSelectedText(obj);
        setFontSize(obj.fontSize ?? 24);
        setFontFamily((obj.fontFamily as string) ?? "Inter");
        setTextColor((obj.fill as string) ?? "#ffffff");
      }
    });
    canvas.on("selection:cleared", () => setSelectedText(null));
    canvas.on("object:modified", () => {
      if (onSaveTextLayers) onSaveTextLayers(canvas.toJSON());
    });

    return () => { canvas.dispose(); };
  }, []);

  // Load image when base64 changes
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || !imageBase64) return;

    fabric.FabricImage.fromURL(`data:image/png;base64,${imageBase64}`).then((img) => {
      img.scaleToWidth(CANVAS_SIZE);
      img.scaleToHeight(CANVAS_SIZE);
      img.set({ selectable: false, evented: false });
      canvas.backgroundImage = img;
      canvas.renderAll();
    });
  }, [imageBase64]);

  // Add text blocks when they change
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || !textBlocks.length) return;

    // Remove old text objects
    canvas.getObjects("i-text").forEach((obj) => canvas.remove(obj));

    textBlocks.forEach((block) => {
      const text = new fabric.IText(block.text, {
        left: block.x,
        top: block.y,
        fontSize: block.fontSize,
        fontFamily: block.fontFamily || "Inter",
        fontWeight: block.fontWeight || "normal",
        fill: block.color || "#ffffff",
        shadow: new fabric.Shadow({ color: "rgba(0,0,0,0.5)", blur: 4, offsetX: 1, offsetY: 1 }),
      });
      canvas.add(text);
    });

    canvas.renderAll();
    if (onSaveTextLayers) onSaveTextLayers(canvas.toJSON());
  }, [textBlocks]);

  const updateSelected = (prop: Partial<fabric.IText>) => {
    if (!selectedText || !fabricRef.current) return;
    selectedText.set(prop);
    fabricRef.current.renderAll();
    if (onSaveTextLayers) onSaveTextLayers(fabricRef.current.toJSON());
  };

  const handleDownload = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.discardActiveObject();
    canvas.renderAll();
    const dataUrl = canvas.toDataURL({ format: "png", multiplier: 1 });
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = "infographic.png";
    link.click();
  };

  const FONTS = ["Inter", "Arial", "Georgia", "Roboto", "Montserrat", "Playfair Display"];

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-200 bg-white flex-shrink-0">
        {selectedText ? (
          <>
            <select
              value={fontFamily}
              onChange={(e) => {
                setFontFamily(e.target.value);
                updateSelected({ fontFamily: e.target.value });
              }}
              className="text-xs border border-gray-300 rounded px-2 py-1"
            >
              {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>

            <input
              type="number"
              value={fontSize}
              min={8}
              max={200}
              onChange={(e) => {
                const v = parseInt(e.target.value) || 24;
                setFontSize(v);
                updateSelected({ fontSize: v });
              }}
              className="w-16 text-xs border border-gray-300 rounded px-2 py-1"
            />

            <button
              onClick={() => updateSelected({ fontWeight: selectedText.fontWeight === "bold" ? "normal" : "bold" })}
              className={`p-1.5 rounded border text-xs ${selectedText.fontWeight === "bold" ? "bg-gray-200 border-gray-400" : "border-gray-300"}`}
            >
              <Bold className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => updateSelected({ fontStyle: selectedText.fontStyle === "italic" ? "normal" : "italic" })}
              className={`p-1.5 rounded border text-xs ${selectedText.fontStyle === "italic" ? "bg-gray-200 border-gray-400" : "border-gray-300"}`}
            >
              <Italic className="w-3.5 h-3.5" />
            </button>

            <input
              type="color"
              value={textColor}
              onChange={(e) => {
                setTextColor(e.target.value);
                updateSelected({ fill: e.target.value });
              }}
              className="w-7 h-7 rounded border border-gray-300 cursor-pointer"
              title="Цвет текста"
            />

            <span className="text-xs text-gray-400 ml-auto">Кликни на текст для редактирования</span>
          </>
        ) : (
          <span className="text-xs text-gray-400">
            {imageBase64 ? "Выбери текстовый блок для редактирования" : "Сгенерируй изображение"}
          </span>
        )}

        <button
          onClick={handleDownload}
          disabled={!imageBase64}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md text-xs font-medium hover:bg-blue-700 disabled:opacity-40"
        >
          <Download className="w-3.5 h-3.5" />
          Скачать PNG
        </button>
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-auto bg-gray-100 flex items-center justify-center p-4">
        <div className="shadow-xl" style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}>
          <canvas ref={canvasRef} />
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/project/[id]/CanvasEditor.tsx
git commit -m "feat: add Fabric.js canvas editor with editable text blocks"
```

---

## Task 12: Redesign project page

**Files:**
- Modify: `src/app/project/[id]/page.tsx`

**Step 1: Replace the entire page.tsx**

```tsx
"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import {
  Upload, Image, Wand2, ChevronLeft, X, RefreshCw,
  Layers, Grid, Star, Sparkles, AlertCircle, Scissors,
} from "lucide-react";
import { SheetsImport } from "./SheetsImport";
import { BgRemover } from "./BgRemover";
import { CarouselSettings } from "./CarouselSettings";

const CanvasEditor = dynamic(() => import("./CanvasEditor"), { ssr: false });

type SlideData = { slide: number; heading: string; texts: string[]; notes: string };

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as Id<"projects">;

  const project = useQuery(api.projects.get, { id: projectId });
  const generatedImages = useQuery(api.images.listByProject, { projectId });

  const setReferenceImage = useMutation(api.projects.setReferenceImage);
  const setProductImage = useMutation(api.projects.setProductImage);
  const updateStyleAnalysis = useMutation(api.projects.updateStyleAnalysis);
  const generateUploadUrl = useMutation(api.images.generateUploadUrl);
  const createImage = useMutation(api.images.create);
  const updateImageData = useMutation(api.images.updateImageData);

  const analyzeStyle = useAction(api.analyze.analyzeReferenceStyle);
  const generatePrompt = useAction(api.analyze.generatePrompt);
  const generateImageAction = useAction(api.imagen.generateImage);
  const removeBackgroundAction = useAction(api.imagen.removeBackground);

  // UI state
  const [referencePreview, setReferencePreview] = useState<string | null>(null);
  const [productPreview, setProductPreview] = useState<string | null>(null);
  const [productBase64, setProductBase64] = useState<string | null>(null);
  const [analyzingReference, setAnalyzingReference] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [removingBg, setRemovingBg] = useState(false);
  const [carouselCount, setCarouselCount] = useState(project?.carouselCount ?? 5);
  const [slideProductImages, setSlideProductImages] = useState<Record<number, string | null>>({});
  const [activeSlot, setActiveSlot] = useState(1);
  const [generationSettings, setGenerationSettings] = useState({
    type: "main" as "main" | "carousel" | "rich",
    utp: "",
    instructions: "",
  });

  // Canvas state
  const [canvasImageBase64, setCanvasImageBase64] = useState<string | null>(null);
  const [canvasTextBlocks, setCanvasTextBlocks] = useState<object[]>([]);
  const [activeImageId, setActiveImageId] = useState<Id<"generatedImages"> | null>(null);

  const sheetsData = project?.sheetsData as SlideData[] | null;
  const styleAnalysis = project?.styleAnalysis as {
    style?: string; colors?: string[]; utp_blocks?: string[];
  } | null;

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleReferenceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setReferencePreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    const uploadUrl = await generateUploadUrl();
    const result = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": file.type }, body: file });
    const { storageId } = await result.json();
    await setReferenceImage({ id: projectId, referenceImageId: storageId });

    setAnalyzingReference(true);
    try {
      const base64 = await fileToBase64(file);
      const analysis = await analyzeStyle({ imageBase64: base64, mediaType: file.type });
      await updateStyleAnalysis({ id: projectId, styleAnalysis: analysis });
    } catch (err) {
      console.error(err);
    } finally {
      setAnalyzingReference(false);
    }
  };

  const handleProductUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setProductPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    const base64 = await fileToBase64(file);
    setProductBase64(base64);
    const uploadUrl = await generateUploadUrl();
    const result = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": file.type }, body: file });
    const { storageId } = await result.json();
    await setProductImage({ id: projectId, productImageId: storageId });
  };

  const handleRemoveProductBg = async () => {
    if (!productBase64) return;
    setRemovingBg(true);
    try {
      const cleanBase64 = await removeBackgroundAction({ imageBase64: productBase64 });
      setProductBase64(cleanBase64);
      setProductPreview(`data:image/png;base64,${cleanBase64}`);
      // Re-upload cleaned image
      const bytes = Uint8Array.from(atob(cleanBase64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "image/png" });
      const uploadUrl = await generateUploadUrl();
      const result = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": "image/png" }, body: blob });
      const { storageId } = await result.json();
      await setProductImage({ id: projectId, productImageId: storageId });
    } catch (err) {
      console.error(err);
    } finally {
      setRemovingBg(false);
    }
  };

  const handleSlideImageUpload = useCallback(
    async (slot: number, base64Preview: string, file: File) => {
      setSlideProductImages((prev) => ({ ...prev, [slot]: base64Preview }));
    },
    []
  );

  const handleGenerate = async (slot?: number) => {
    const targetSlot = slot ?? (generationSettings.type === "carousel" ? activeSlot : 1);
    if (!project?.referenceImageId || !project?.productImageId) {
      alert("Загрузите референс и фото товара");
      return;
    }
    if (!project.styleAnalysis) {
      alert("Дождитесь анализа стиля референса");
      return;
    }
    setGenerating(true);
    try {
      const slideData = sheetsData?.find((s) => s.slide === targetSlot) ?? sheetsData?.[0] ?? null;
      const genData = await generatePrompt({
        styleAnalysis: project.styleAnalysis,
        projectName: project.name,
        type: generationSettings.type,
        slot: targetSlot,
        utp: generationSettings.utp,
        instructions: generationSettings.instructions,
        slideData,
      });

      const imageRecord = await createImage({
        projectId,
        type: generationSettings.type,
        slot: targetSlot,
        prompt: genData.prompt,
        styleNotes: genData.style_notes,
        suggestedText: genData.suggested_text,
      });

      const imageBase64 = await generateImageAction({ prompt: genData.prompt });

      // Store in Convex storage
      const bytes = Uint8Array.from(atob(imageBase64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "image/png" });
      const uploadUrl = await generateUploadUrl();
      const uploadResult = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": "image/png" },
        body: blob,
      });
      const { storageId } = await uploadResult.json();
      await updateImageData({
        id: imageRecord,
        imageId: storageId,
        textLayers: genData.textBlocks,
      });

      // Show in canvas
      setCanvasImageBase64(imageBase64);
      setCanvasTextBlocks(genData.textBlocks ?? []);
      setActiveImageId(imageRecord);
    } catch (err) {
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateAll = async () => {
    for (let slot = 1; slot <= carouselCount; slot++) {
      await handleGenerate(slot);
    }
  };

  const loadImageToCanvas = async (img: {
    _id: Id<"generatedImages">;
    imageId?: Id<"_storage">;
    textLayers?: object;
  }) => {
    if (!img.imageId) return;
    const url = await (async () => {
      const r = await fetch(`/api/image?storageId=${img.imageId}`);
      const d = await r.json();
      return d.url;
    })();
    if (!url) return;
    const resp = await fetch(url);
    const ab = await resp.arrayBuffer();
    const b64 = btoa(String.fromCharCode(...new Uint8Array(ab)));
    setCanvasImageBase64(b64);
    setCanvasTextBlocks((img.textLayers as object[]) ?? []);
    setActiveImageId(img._id);
  };

  const saveTextLayers = useCallback(
    async (json: object) => {
      if (!activeImageId) return;
      await updateImageData({ id: activeImageId, textLayers: json });
    },
    [activeImageId, updateImageData]
  );

  if (!project)
    return <div className="h-screen flex items-center justify-center text-gray-500">Загрузка...</div>;

  const carouselImages = generatedImages?.filter((i) => i.type === generationSettings.type) ?? [];

  return (
    <div className="h-screen flex bg-gray-50">
      {/* Left Panel */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col overflow-auto">
        {/* Header */}
        <div className="border-b border-gray-200 px-4 py-3 flex items-center gap-2 flex-shrink-0">
          <button onClick={() => router.push("/")} className="p-1.5 hover:bg-gray-100 rounded">
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h2 className="font-semibold text-gray-900 text-sm flex-1">{project.name}</h2>
        </div>

        <div className="flex-1 p-4 space-y-5 overflow-auto">
          {/* Google Sheets Import */}
          <SheetsImport
            projectId={projectId}
            currentUrl={project.sheetsUrl}
            slidesCount={sheetsData?.length}
          />

          {/* Reference Upload */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
              Референс инфографики
            </label>
            {!referencePreview && !project.referenceImageId ? (
              <label className="block border-2 border-dashed border-gray-300 rounded-lg p-5 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all">
                <input type="file" accept="image/*" onChange={handleReferenceUpload} className="hidden" />
                <Upload className="w-7 h-7 text-gray-400 mx-auto mb-1" />
                <p className="text-xs text-gray-600 font-medium">Загрузить референс</p>
              </label>
            ) : (
              <div className="space-y-2">
                {referencePreview && (
                  <div className="relative group">
                    <img src={referencePreview} className="w-full rounded-lg border border-gray-200" />
                    <button
                      onClick={() => setReferencePreview(null)}
                      className="absolute top-2 right-2 p-1 bg-white rounded-md shadow-sm opacity-0 group-hover:opacity-100"
                    >
                      <X className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>
                )}
                {analyzingReference && (
                  <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 p-2 rounded">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Анализирую стиль...
                  </div>
                )}
                {styleAnalysis && (
                  <div className="bg-purple-50 p-2.5 rounded border border-purple-200 text-xs text-purple-800">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                      <span className="font-semibold">Стиль: {styleAnalysis.style}</span>
                    </div>
                    {styleAnalysis.colors && (
                      <div className="flex gap-1">
                        {styleAnalysis.colors.slice(0, 6).map((c, i) => (
                          <div key={i} className="w-5 h-5 rounded border border-white shadow-sm" style={{ backgroundColor: c }} title={c} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Product Upload */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
              Фото товара
            </label>
            {!productPreview && !project.productImageId ? (
              <label className="block border-2 border-dashed border-gray-300 rounded-lg p-5 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all">
                <input type="file" accept="image/*" onChange={handleProductUpload} className="hidden" />
                <Image className="w-7 h-7 text-gray-400 mx-auto mb-1" />
                <p className="text-xs text-gray-600 font-medium">Загрузить фото</p>
              </label>
            ) : (
              <div className="space-y-2">
                {productPreview && (
                  <div className="relative group">
                    <img src={productPreview} className="w-full rounded-lg border border-gray-200 bg-gray-50" />
                    <button
                      onClick={() => { setProductPreview(null); setProductBase64(null); }}
                      className="absolute top-2 right-2 p-1 bg-white rounded-md shadow-sm opacity-0 group-hover:opacity-100"
                    >
                      <X className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>
                )}
                <button
                  onClick={handleRemoveProductBg}
                  disabled={removingBg || !productBase64}
                  className="w-full py-1.5 border border-purple-300 text-purple-700 rounded-md text-xs font-medium hover:bg-purple-50 disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {removingBg ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Scissors className="w-3.5 h-3.5" />}
                  {removingBg ? "Убираю фон..." : "Очистить фон"}
                </button>
              </div>
            )}
          </div>

          {/* Type Selection */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
              Тип изображения
            </label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { id: "main", label: "Главное", icon: Star },
                { id: "carousel", label: "Карусель", icon: Layers },
                { id: "rich", label: "Рич", icon: Grid },
              ] as const).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setGenerationSettings({ ...generationSettings, type: id })}
                  className={`p-2 rounded-md border text-xs font-medium transition-all ${
                    generationSettings.type === id
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 text-gray-700 hover:border-gray-300"
                  }`}
                >
                  <Icon className="w-4 h-4 mx-auto mb-0.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Carousel settings */}
          {generationSettings.type === "carousel" && (
            <CarouselSettings
              projectId={projectId}
              carouselCount={carouselCount}
              onCountChange={setCarouselCount}
              slideProductImages={slideProductImages}
              onSlideImageUpload={handleSlideImageUpload}
            />
          )}

          {/* UTP / Instructions */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">УТП товара</label>
            <input
              type="text"
              value={generationSettings.utp}
              onChange={(e) => setGenerationSettings({ ...generationSettings, utp: e.target.value })}
              placeholder="Бесплатная доставка"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">Доп. инструкции</label>
            <textarea
              value={generationSettings.instructions}
              onChange={(e) => setGenerationSettings({ ...generationSettings, instructions: e.target.value })}
              placeholder="Особые требования..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Background remover tool */}
          <BgRemover />
        </div>

        {/* Generate Button */}
        <div className="border-t border-gray-200 p-4 flex-shrink-0 space-y-2">
          <button
            onClick={() => handleGenerate()}
            disabled={!project.referenceImageId || !project.productImageId || generating}
            className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
          >
            {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            {generating ? "Генерируем..." : "Сгенерировать"}
          </button>
          {generationSettings.type === "carousel" && (
            <button
              onClick={handleGenerateAll}
              disabled={!project.referenceImageId || !project.productImageId || generating}
              className="w-full py-2 border border-blue-400 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-50 disabled:opacity-50"
            >
              Сгенерировать все {carouselCount} слайдов
            </button>
          )}
          {!project.referenceImageId && (
            <div className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 p-2 rounded">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              Загрузите референс и фото товара
            </div>
          )}
        </div>
      </div>

      {/* Right Panel — Canvas + Thumbnails */}
      <div className="flex-1 flex flex-col min-w-0">
        <CanvasEditor
          imageBase64={canvasImageBase64}
          textBlocks={canvasTextBlocks as Parameters<typeof CanvasEditor>[0]["textBlocks"]}
          onSaveTextLayers={saveTextLayers}
        />

        {/* Thumbnail strip for carousel */}
        {carouselImages.length > 0 && (
          <div className="border-t border-gray-200 bg-white p-3 flex gap-3 overflow-x-auto flex-shrink-0">
            {carouselImages.map((img) => (
              <button
                key={img._id}
                onClick={() => loadImageToCanvas(img)}
                className={`flex-shrink-0 w-20 h-20 rounded-lg border-2 overflow-hidden ${
                  activeImageId === img._id ? "border-blue-500" : "border-gray-200"
                }`}
              >
                <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                  <span className="text-xs text-gray-500">#{img.slot}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Run the dev server and verify it compiles**

```bash
npx next build 2>&1 | head -50
```

Expected: builds without TypeScript errors. Fix any type errors before proceeding.

**Step 3: Start dev server and manually test**

```bash
npm run dev
```

Open http://localhost:3000, create a project, verify all panels render.

**Step 4: Commit**

```bash
git add src/app/project/[id]/page.tsx
git commit -m "feat: full project page redesign with canvas, sheets, carousel"
```

---

## Task 13: Add Vercel environment variable for Google Service Account

**Files:**
- None (Vercel dashboard config)

**Step 1: Add env var in Vercel**

In Vercel dashboard → Project → Settings → Environment Variables:
- Name: `GOOGLE_SERVICE_ACCOUNT_JSON`
- Value: paste the full contents of your service account JSON file
- Environments: Production, Preview, Development

**Step 2: Also set in Convex production**

```bash
npx convex env set GOOGLE_SERVICE_ACCOUNT_JSON "$(cat /path/to/service-account.json)" --prod
```

---

## Task 14: Push to GitHub and verify Vercel deploy

**Step 1: Push all commits**

```bash
git push origin master
```

**Step 2: Watch Vercel deploy**

Go to Vercel dashboard → Deployments. The build should start automatically.

**Step 3: Verify production**

Open the Vercel URL. Test:
- [ ] Create a new project
- [ ] Paste Google Sheets URL and load slides
- [ ] Upload reference image — style analysis runs
- [ ] Upload product photo — "Очистить фон" button appears
- [ ] Select Карусель, set 5 slides
- [ ] Click "Сгенерировать" — Imagen 4 generates image
- [ ] Canvas opens with editable text blocks
- [ ] Click text block → toolbar appears, edit font/size/color
- [ ] Download PNG
- [ ] BgRemover section works independently

---

## Notes

**Background removal API:** The `editMode: "product-image"` parameter for `imagen-3.0-capability-001` is the closest match for background removal. If this returns an error, check Vertex AI documentation for the exact `editMode` value — it may be `"EDIT_MODE_BGSWAP"` or a segmentation endpoint.

**Fabric.js v6:** Uses named exports (`fabric.Canvas`, `fabric.IText`, `fabric.FabricImage`). If you installed v5, use default import: `import { fabric } from 'fabric'`.

**Canvas image loading:** The `loadImageToCanvas` function in page.tsx currently uses a placeholder `/api/image` route. Either add a Next.js API route at `src/app/api/image/route.ts` that returns Convex storage URLs, or use the existing `api.images.getImageUrl` Convex query directly via React.
