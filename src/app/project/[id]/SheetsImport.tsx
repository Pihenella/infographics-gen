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
