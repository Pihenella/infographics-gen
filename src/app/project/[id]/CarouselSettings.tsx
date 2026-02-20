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
                  alt={`slide ${slot}`}
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
