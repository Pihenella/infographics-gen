"use node";

import { action } from "./_generated/server";
import { v, ConvexError } from "convex/values";

async function geminiGenerate(parts: object[]): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new ConvexError("GEMINI_API_KEY not set");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { maxOutputTokens: 2048, temperature: 0.4 },
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const errMsg = data.error?.message || JSON.stringify(data);
    throw new ConvexError(`Gemini API error (${response.status}): ${errMsg}`);
  }

  const text: string =
    data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  if (!text) {
    throw new ConvexError(
      "Empty Gemini response: " + JSON.stringify(data).slice(0, 300)
    );
  }

  return text;
}

export const analyzeReferenceStyle = action({
  args: {
    imageBase64: v.string(),
    mediaType: v.string(),
  },
  handler: async (_ctx, args) => {
    const text = await geminiGenerate([
      {
        inlineData: {
          mimeType: args.mediaType,
          data: args.imageBase64,
        },
      },
      {
        text: `Проанализируй эту инфографику для товара на маркетплейсе. Опиши детально:

1. Композицию и layout (расположение элементов, сетка)
2. Цветовую схему (основные и акцентные цвета, hex коды)
3. Типографику (шрифты, размеры, начертания)
4. Стиль графики (иконки, формы, иллюстрации)
5. Текстовые блоки (какие УТП, как оформлены)
6. Фоновые эффекты (градиенты, тени, текстуры)
7. Общий стиль (минимализм, максимализм, премиум и т.д.)

Верни ТОЛЬКО JSON без markdown-обёртки:
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
    ]);

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new ConvexError(
      "Failed to parse style analysis. Response: " + text.slice(0, 500)
    );
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
    slideData: v.optional(v.any()),
  },
  handler: async (_ctx, args) => {
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

    const text = await geminiGenerate([
      {
        text: `Создай промпт для генерации инфографики товара, используя стиль из анализа.

Стиль референса:
${JSON.stringify(args.styleAnalysis, null, 2)}

Товар: ${args.projectName}
Тип изображения: ${typeLabel}
УТП: ${args.utp || "не указано"}
Дополнительно: ${args.instructions || "нет"}
${slideContext}

Верни ТОЛЬКО JSON без markdown-обёртки:
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
    ]);

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new ConvexError(
      "Failed to parse generation prompt. Response: " + text.slice(0, 500)
    );
  },
});
