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
              <img src={preview} alt="original" className="w-full rounded border border-gray-200 bg-gray-50" />
            </div>
            {resultBase64 && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Результат</p>
                <img
                  src={`data:image/png;base64,${resultBase64}`}
                  alt="result"
                  className="w-full rounded border border-gray-200"
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
