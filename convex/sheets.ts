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
