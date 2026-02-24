"use node";

import { action } from "./_generated/server";
import { v, ConvexError } from "convex/values";

export const analyzeReferenceStyle = action({
  args: {
    imageBase64: v.string(),
    mediaType: v.string(),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new ConvexError("ANTHROPIC_API_KEY not set");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 2000,
        messages: [
          {
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
            ],
          },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const errMsg = data.error?.message || JSON.stringify(data);
      throw new ConvexError(`Anthropic API error (${response.status}): ${errMsg}`);
    }

    const textContent =
      data.content?.find((item: { type: string }) => item.type === "text")?.text || "";
    const jsonMatch = textContent.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new ConvexError(
      "Failed to parse style analysis. Response: " + textContent.slice(0, 500)
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
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new ConvexError("ANTHROPIC_API_KEY not set");

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
        model: "claude-sonnet-4-6",
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
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const errMsg = data.error?.message || JSON.stringify(data);
      throw new ConvexError(`Anthropic API error (${response.status}): ${errMsg}`);
    }

    const textContent =
      data.content?.find((item: { type: string }) => item.type === "text")?.text || "";
    const jsonMatch = textContent.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new ConvexError(
      "Failed to parse generation prompt. Response: " + textContent.slice(0, 500)
    );
  },
});
