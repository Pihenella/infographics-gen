# Full Redesign Design — InfographicsGen
Date: 2026-02-20

## Overview
Full redesign of the project page with Canvas-based editor as the centrepiece. Adds Google Sheets TZ import, Vertex AI Imagen 4 Ultra image generation, per-slide product photos, carousel slide count selection, background removal, and interactive text editing via Fabric.js.

## Stack Additions
- `fabric` — canvas editor with editable text layers
- `google-auth-library` — Service Account JSON auth for Vertex AI
- Google Sheets: public CSV export fetch (no Sheets API needed)

## Architecture

### Data Flow
```
Google Sheet URL
       ↓
Convex: fetch CSV → parse slides (number, heading, texts, design notes)
       ↓
Anthropic: generate prompt using style analysis + sheets slide data
       ↓
Vertex AI Imagen 4 Ultra: generate PNG image
       ↓
Fabric.js Canvas: render image as background + text blocks as IText layers
       ↓
User edits text, font, size → Export PNG
```

### Environment Variables
- `ANTHROPIC_API_KEY` — already exists
- `GOOGLE_SERVICE_ACCOUNT_JSON` — full service account JSON string
- Project ID is read from the service account JSON (no separate var needed)

## Convex Schema Changes

### projects table — new fields
- `sheetsUrl: v.optional(v.string())` — Google Sheets URL
- `sheetsData: v.optional(v.any())` — parsed slides array
- `carouselCount: v.optional(v.number())` — total carousel slides

### generatedImages table — new fields
- `imageStorageId: v.optional(v.id("_storage"))` — actual generated PNG
- `textLayers: v.optional(v.any())` — Fabric.js canvas JSON
- `slideProductImageId: v.optional(v.id("_storage"))` — per-slide product photo

## New Convex Files

### convex/sheets.ts
Action: `fetchAndParse(url: string)`
- Fetches `https://docs.google.com/spreadsheets/d/{id}/export?format=csv&gid={gid}`
- Parses CSV rows: slide number, content type, text, design notes
- Returns: `Array<{ slide: number, heading: string, texts: string[], notes: string }>`
- Saves result to `projects.sheetsData`

### convex/imagen.ts
Action: `generateImage(prompt, productImageBase64, projectId, slot)`
- Gets Access Token from `GOOGLE_SERVICE_ACCOUNT_JSON` via `google-auth-library`
- POST to `https://us-central1-aiplatform.googleapis.com/v1/projects/{projectId}/locations/us-central1/publishers/google/models/imagen-4.0-ultra-generate-001:predict`
- Returns base64 PNG → stores in Convex Storage → updates `generatedImages.imageStorageId`

Action: `removeBackground(imageBase64)`
- Uses Vertex AI Imagen edit endpoint (`imagen-3.0-capability-001`)
- `editConfig: { backgroundRemovalConfig: {} }` — no mask needed
- Returns base64 PNG without background

### convex/analyze.ts — updated
`generatePrompt` now accepts optional `slideData` param:
- Merges slide heading + texts + design notes into the prompt
- Instructs Anthropic to also return `textBlocks: [{text, x, y, fontSize, fontFamily}]` for canvas positioning

## UI Layout

### Left Panel (320px)
```
[←] Project Name
──────────────────
📊 ИСТОЧНИК ТЗ
[Google Sheets URL input]
[Загрузить ТЗ] → "9 слайдов найдено"

──────────────────
🖼 ФОТО ТОВАРА
[drag & drop]
[Очистить фон]

──────────────────
⚙️ ТИП
[Главное] [Карусель] [Рич]

(if Карусель)
Слайдов: [1][2]...[10]
  Слайд 1: [фото (опц.)]
  Слайд 2: [фото (опц.)]
  ...

──────────────────
УТП / Инструкции

[🪄 Сгенерировать]

──────────────────
🧹 ОЧИСТИТЬ ФОН
[Upload any photo]
[Убрать фон → скачать]
```

### Right Panel — Canvas Editor
```
[Тулбар: шрифт ▾ | размер ▾ | B I | цвет] ← visible on text select
┌────────────────────────────────────────┐
│  Generated image (background layer)    │
│  + fabric.IText blocks (editable)      │
└────────────────────────────────────────┘
[← Слайд 1]  2/5  [Слайд 3 →]
[💾 Скачать PNG]  [💾 Скачать все]
```

## New Frontend Files

| File | Purpose |
|------|---------|
| `src/app/project/[id]/page.tsx` | Full redesign — orchestrates all panels |
| `src/app/project/[id]/CanvasEditor.tsx` | Fabric.js canvas, text toolbar, export |
| `src/app/project/[id]/SheetsImport.tsx` | URL input, fetch, slide count preview |
| `src/app/project/[id]/BgRemover.tsx` | Standalone bg removal tool |
| `src/app/project/[id]/CarouselSettings.tsx` | Slide count selector + per-slide photo upload |

## Key Implementation Notes

### Fabric.js text positioning
Anthropic returns `textBlocks` array in `generatePrompt` response:
```json
[
  { "text": "160 предметов", "x": 50, "y": 80, "fontSize": 32, "fontFamily": "Inter" },
  { "text": "Набор инструментов KINGQUEEN", "x": 50, "y": 140, "fontSize": 18 }
]
```
These become `fabric.IText` objects placed on canvas at those coordinates.

### Carousel generation
- User sets `carouselCount = 5`
- UI shows 5 slot cards, each with optional per-slide product photo
- "Сгенерировать все" → loops through slots, calls `imagen.generateImage` for each
- Each slot uses corresponding row from `sheetsData` array

### Background removal as pre-step
- When user uploads product photo, a "Очистить фон" button appears below
- Clicking it calls `imagen.removeBackground` → replaces product photo with cleaned version
- Cleaned version is used in all subsequent generations

### Canvas export
- Single slide: `canvas.toDataURL('image/png')` → download
- All slides: loop through each generatedImage, reconstruct canvas from `textLayers` JSON, export each
