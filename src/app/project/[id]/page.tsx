"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useAction } from "convex/react";
import dynamic from "next/dynamic";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import {
  Upload,
  ChevronLeft,
  X,
  RefreshCw,
  Layers,
  Grid,
  Star,
  Sparkles,
  AlertCircle,
  Wand2,
  Scissors,
} from "lucide-react";
import { SheetsImport } from "./SheetsImport";
import { BgRemover } from "./BgRemover";
import { CarouselSettings } from "./CarouselSettings";

const CanvasEditor = dynamic(() => import("./CanvasEditor"), { ssr: false });

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as Id<"projects">;

  // --- Convex queries ---
  const project = useQuery(api.projects.get, { id: projectId });
  const generatedImages = useQuery(api.images.listByProject, { projectId });

  // --- Convex mutations ---
  const setReferenceImage = useMutation(api.projects.setReferenceImage);
  const setProductImage = useMutation(api.projects.setProductImage);
  const updateStyleAnalysis = useMutation(api.projects.updateStyleAnalysis);
  const generateUploadUrl = useMutation(api.images.generateUploadUrl);
  const createImage = useMutation(api.images.create);
  const updateImageData = useMutation(api.images.updateImageData);

  // --- Convex actions ---
  const analyzeStyle = useAction(api.analyze.analyzeReferenceStyle);
  const generatePromptAction = useAction(api.analyze.generatePrompt);
  const generateImageAction = useAction(api.imagen.generateImage);
  const removeBackgroundAction = useAction(api.imagen.removeBackground);

  // --- State ---
  const [referencePreview, setReferencePreview] = useState<string | null>(null);
  const [productPreview, setProductPreview] = useState<string | null>(null);
  const [productBase64, setProductBase64] = useState<string | null>(null);
  const [analyzingReference, setAnalyzingReference] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [removingBg, setRemovingBg] = useState(false);
  const [carouselCount, setCarouselCount] = useState(5);
  const [slideProductImages, setSlideProductImages] = useState<
    Record<number, string | null>
  >({});
  const [activeSlot, setActiveSlot] = useState(1);
  const [generationSettings, setGenerationSettings] = useState<{
    type: "main" | "carousel" | "rich";
    utp: string;
    instructions: string;
  }>({
    type: "main",
    utp: "",
    instructions: "",
  });
  const [canvasImageBase64, setCanvasImageBase64] = useState<string | null>(
    null
  );
  const [canvasTextBlocks, setCanvasTextBlocks] = useState<object[]>([]);
  const [activeImageId, setActiveImageId] = useState<
    Id<"generatedImages"> | null
  >(null);

  // Sync carouselCount from project when it loads
  useEffect(() => {
    if (project?.carouselCount != null) {
      setCarouselCount(project.carouselCount);
    }
  }, [project?.carouselCount]);

  // --- Helpers ---
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // --- Handlers ---
  const handleReferenceUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Set preview
    const reader = new FileReader();
    reader.onload = (event) => {
      setReferencePreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Upload to Convex storage
    const uploadUrl = await generateUploadUrl();
    const result = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: file,
    });
    const { storageId } = await result.json();
    await setReferenceImage({ id: projectId, referenceImageId: storageId });

    // Analyze style
    setAnalyzingReference(true);
    try {
      const base64 = await fileToBase64(file);
      const analysis = await analyzeStyle({
        imageBase64: base64,
        mediaType: file.type,
      });
      await updateStyleAnalysis({ id: projectId, styleAnalysis: analysis });
    } catch (error) {
      console.error("Analysis error:", error);
    } finally {
      setAnalyzingReference(false);
    }
  };

  const handleProductUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      setProductPreview(dataUrl);
      const b64 = dataUrl.split(",")[1];
      setProductBase64(b64);
    };
    reader.readAsDataURL(file);

    // Upload to Convex storage
    const uploadUrl = await generateUploadUrl();
    const result = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: file,
    });
    const { storageId } = await result.json();
    await setProductImage({ id: projectId, productImageId: storageId });
  };

  const handleRemoveProductBg = async () => {
    if (!productBase64) return;
    setRemovingBg(true);
    try {
      const cleanedBase64 = await removeBackgroundAction({
        imageBase64: productBase64,
      });
      setProductPreview(`data:image/png;base64,${cleanedBase64}`);
      setProductBase64(cleanedBase64);

      // Re-upload cleaned image
      const blob = base64ToBlob(cleanedBase64, "image/png");
      const uploadUrl = await generateUploadUrl();
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": "image/png" },
        body: blob,
      });
      const { storageId } = await result.json();
      await setProductImage({ id: projectId, productImageId: storageId });
    } catch (error) {
      console.error("BgRemove error:", error);
    } finally {
      setRemovingBg(false);
    }
  };

  const base64ToBlob = (base64: string, mimeType: string): Blob => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    return new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
  };

  const handleGenerate = async (slot?: number) => {
    if (!project?.referenceImageId || !project?.productImageId) {
      alert("Загрузите референс и фото товара");
      return;
    }
    if (!project.styleAnalysis) {
      alert("Дождитесь анализа стиля референса");
      return;
    }

    const targetSlot =
      slot ?? (generationSettings.type === "carousel" ? activeSlot : 1);

    const sheetsData = project.sheetsData as
      | Array<{ slot?: number; heading?: string; texts?: string[]; notes?: string }>
      | null
      | undefined;
    const slideData = sheetsData
      ? (sheetsData.find((s) => s.slot === targetSlot) ?? sheetsData[0])
      : undefined;

    setGenerating(true);
    try {
      // Generate prompt
      const genData = await generatePromptAction({
        styleAnalysis: project.styleAnalysis,
        projectName: project.name,
        type: generationSettings.type,
        slot: targetSlot,
        utp: generationSettings.utp,
        instructions: generationSettings.instructions,
        slideData,
      });

      // Create DB record
      const imageDbId = await createImage({
        projectId,
        type: generationSettings.type,
        slot: targetSlot,
        prompt: genData.prompt ?? "",
        styleNotes: genData.style_notes ?? "",
        suggestedText: genData.suggested_text ?? "",
      });

      // Generate image via Imagen
      const imageBase64 = await generateImageAction({ prompt: genData.prompt });

      // Upload generated image to Convex storage
      const blob = base64ToBlob(imageBase64, "image/png");
      const uploadUrl = await generateUploadUrl();
      const uploadResult = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": "image/png" },
        body: blob,
      });
      const { storageId } = await uploadResult.json();

      // Update DB record with image and text layers
      await updateImageData({
        id: imageDbId,
        imageId: storageId,
        textLayers: genData.textBlocks ?? [],
      });

      // Update canvas state
      setCanvasImageBase64(imageBase64);
      setCanvasTextBlocks(
        Array.isArray(genData.textBlocks) ? genData.textBlocks : []
      );
      setActiveImageId(imageDbId);
    } catch (error) {
      console.error("Generation error:", error);
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateAll = async () => {
    for (let slot = 1; slot <= carouselCount; slot++) {
      await handleGenerate(slot);
    }
  };

  const saveTextLayers = useCallback(
    (json: object) => {
      if (!activeImageId) return;
      updateImageData({ id: activeImageId, textLayers: json }).catch(
        console.error
      );
    },
    [activeImageId, updateImageData]
  );

  const handleThumbnailClick = (
    img: NonNullable<typeof generatedImages>[number]
  ) => {
    if (!img._id) return;
    setCanvasTextBlocks((img.textLayers as object[]) ?? []);
    setActiveImageId(img._id);
    // Note: actual image pixel data would need to be re-fetched via URL.
    // For MVP: canvasImageBase64 stays as last generated image.
  };

  const handleSlideImageUpload = (
    slot: number,
    base64: string,
    _file: File
  ) => {
    setSlideProductImages((prev) => ({ ...prev, [slot]: base64 }));
  };

  // --- Derived ---
  const styleAnalysis = project?.styleAnalysis as
    | {
        style?: string;
        colors?: string[];
        utp_blocks?: string[];
      }
    | null
    | undefined;

  const sheetsDataArray = project?.sheetsData as
    | Array<unknown>
    | null
    | undefined;

  if (project === undefined) {
    return (
      <div className="h-screen flex items-center justify-center text-gray-500">
        Загрузка...
      </div>
    );
  }

  if (project === null) {
    return (
      <div className="h-screen flex items-center justify-center text-gray-500">
        Проект не найден
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-gray-50 overflow-hidden">
      {/* ===== LEFT PANEL ===== */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
        {/* Header */}
        <div className="border-b border-gray-200 px-4 py-3 flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => router.push("/")}
            className="p-1.5 hover:bg-gray-100 rounded transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-gray-900 text-sm truncate">
              {project.name}
            </h2>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-5">
            {/* Sheets Import */}
            <SheetsImport
              projectId={projectId}
              currentUrl={project.sheetsUrl}
              slidesCount={
                sheetsDataArray != null ? sheetsDataArray.length : undefined
              }
            />

            {/* Reference Image Upload */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                Референс инфографики
              </label>

              {!referencePreview && !project.referenceImageId ? (
                <label className="block border-2 border-dashed border-gray-300 rounded-lg p-5 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleReferenceUpload}
                    className="hidden"
                  />
                  <Upload className="w-7 h-7 text-gray-400 mx-auto mb-1.5" />
                  <p className="text-sm font-medium text-gray-700">
                    Загрузить референс
                  </p>
                  <p className="text-xs text-gray-500 mt-1">PNG, JPG до 10MB</p>
                </label>
              ) : (
                <div className="space-y-3">
                  {referencePreview && (
                    <div className="relative group">
                      <img
                        src={referencePreview}
                        alt="Reference"
                        className="w-full rounded-lg border border-gray-200"
                      />
                      <button
                        onClick={() => setReferencePreview(null)}
                        className="absolute top-2 right-2 p-1.5 bg-white rounded-md shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-4 h-4 text-gray-600" />
                      </button>
                    </div>
                  )}

                  {analyzingReference && (
                    <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 p-3 rounded-lg">
                      <RefreshCw className="w-4 h-4 animate-spin flex-shrink-0" />
                      Анализирую стиль...
                    </div>
                  )}

                  {styleAnalysis && !analyzingReference && (
                    <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-3 rounded-lg border border-purple-200">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-4 h-4 text-purple-600 flex-shrink-0" />
                        <span className="text-xs font-semibold text-purple-900">
                          Стиль распознан
                        </span>
                      </div>
                      <div className="space-y-1.5 text-xs text-purple-800">
                        {styleAnalysis.style && (
                          <div>
                            <span className="font-medium">Стиль:</span>{" "}
                            {styleAnalysis.style}
                          </div>
                        )}
                        {styleAnalysis.colors &&
                          styleAnalysis.colors.length > 0 && (
                            <div>
                              <span className="font-medium">Цвета:</span>
                              <div className="flex gap-1 mt-1 flex-wrap">
                                {styleAnalysis.colors
                                  .slice(0, 6)
                                  .map((color, i) => (
                                    <div
                                      key={i}
                                      className="w-5 h-5 rounded border border-white shadow-sm"
                                      style={{ backgroundColor: color }}
                                      title={color}
                                    />
                                  ))}
                              </div>
                            </div>
                          )}
                        {styleAnalysis.utp_blocks &&
                          styleAnalysis.utp_blocks.length > 0 && (
                            <div>
                              <span className="font-medium">
                                УТП на референсе:
                              </span>
                              <ul className="mt-1 space-y-0.5">
                                {styleAnalysis.utp_blocks
                                  .slice(0, 3)
                                  .map((utp, i) => (
                                    <li key={i}>&#8226; {utp}</li>
                                  ))}
                              </ul>
                            </div>
                          )}
                      </div>
                    </div>
                  )}

                  {/* Allow re-uploading when already loaded from DB but no local preview */}
                  {!referencePreview && project.referenceImageId && (
                    <label className="block border border-dashed border-gray-300 rounded px-3 py-2 text-center cursor-pointer hover:border-blue-400 transition-colors">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleReferenceUpload}
                        className="hidden"
                      />
                      <span className="text-xs text-gray-500">
                        Заменить референс
                      </span>
                    </label>
                  )}
                </div>
              )}
            </div>

            {/* Product Image Upload */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                Фото товара
              </label>

              {!productPreview && !project.productImageId ? (
                <label className="block border-2 border-dashed border-gray-300 rounded-lg p-5 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleProductUpload}
                    className="hidden"
                  />
                  <Upload className="w-7 h-7 text-gray-400 mx-auto mb-1.5" />
                  <p className="text-sm font-medium text-gray-700">
                    Загрузить товар
                  </p>
                  <p className="text-xs text-gray-500 mt-1">PNG без фона</p>
                </label>
              ) : (
                <div className="space-y-2">
                  {productPreview && (
                    <div className="relative group">
                      <img
                        src={productPreview}
                        alt="Product"
                        className="w-full rounded-lg border border-gray-200 bg-gray-50"
                      />
                      <button
                        onClick={() => {
                          setProductPreview(null);
                          setProductBase64(null);
                        }}
                        className="absolute top-2 right-2 p-1.5 bg-white rounded-md shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-4 h-4 text-gray-600" />
                      </button>
                    </div>
                  )}

                  {/* Bg Removal button for product */}
                  {productBase64 && (
                    <button
                      onClick={handleRemoveProductBg}
                      disabled={removingBg}
                      className="w-full py-1.5 border border-purple-300 text-purple-700 rounded-md text-xs font-medium hover:bg-purple-50 disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors"
                    >
                      {removingBg ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Scissors className="w-3.5 h-3.5" />
                      )}
                      {removingBg ? "Очищаю фон..." : "Очистить фон товара"}
                    </button>
                  )}

                  {!productPreview && project.productImageId && (
                    <label className="block border border-dashed border-gray-300 rounded px-3 py-2 text-center cursor-pointer hover:border-blue-400 transition-colors">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleProductUpload}
                        className="hidden"
                      />
                      <span className="text-xs text-gray-500">
                        Заменить фото товара
                      </span>
                    </label>
                  )}
                </div>
              )}
            </div>

            {/* Type Selector */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                Тип изображения
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: "main", label: "Главное", icon: Star },
                    { id: "carousel", label: "Карусель", icon: Layers },
                    { id: "rich", label: "Рич", icon: Grid },
                  ] as const
                ).map((type) => {
                  const Icon = type.icon;
                  const isActive = generationSettings.type === type.id;
                  return (
                    <button
                      key={type.id}
                      onClick={() =>
                        setGenerationSettings((prev) => ({
                          ...prev,
                          type: type.id,
                        }))
                      }
                      className={`p-2.5 rounded-md border transition-all text-xs font-medium ${
                        isActive
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-gray-200 text-gray-700 hover:border-gray-300"
                      }`}
                    >
                      <Icon className="w-4 h-4 mx-auto mb-1" />
                      {type.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Carousel Settings */}
            {generationSettings.type === "carousel" && (
              <div className="space-y-3">
                <CarouselSettings
                  projectId={projectId}
                  carouselCount={carouselCount}
                  onCountChange={setCarouselCount}
                  slideProductImages={slideProductImages}
                  onSlideImageUpload={handleSlideImageUpload}
                />

                {/* Active slot selector for single generate */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">
                    Активный слайд для генерации
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {Array.from({ length: carouselCount }, (_, i) => i + 1).map(
                      (slot) => (
                        <button
                          key={slot}
                          onClick={() => setActiveSlot(slot)}
                          className={`w-7 h-7 rounded text-xs font-medium border transition-all ${
                            activeSlot === slot
                              ? "border-blue-500 bg-blue-500 text-white"
                              : "border-gray-200 text-gray-700 hover:border-blue-300"
                          }`}
                        >
                          {slot}
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* UTP Input */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                УТП товара
              </label>
              <input
                type="text"
                value={generationSettings.utp}
                onChange={(e) =>
                  setGenerationSettings((prev) => ({
                    ...prev,
                    utp: e.target.value,
                  }))
                }
                placeholder="Например: Бесплатная доставка"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Instructions */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                Доп. инструкции
              </label>
              <textarea
                value={generationSettings.instructions}
                onChange={(e) =>
                  setGenerationSettings((prev) => ({
                    ...prev,
                    instructions: e.target.value,
                  }))
                }
                placeholder="Особые требования..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>

            {/* BgRemover - standalone tool */}
            <BgRemover />
          </div>
        </div>

        {/* Bottom action area */}
        <div className="border-t border-gray-200 p-4 flex-shrink-0 space-y-2">
          <button
            onClick={() => handleGenerate()}
            disabled={
              !project.referenceImageId ||
              !project.productImageId ||
              generating
            }
            className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
          >
            {generating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Генерируем...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                Сгенерировать
              </>
            )}
          </button>

          {generationSettings.type === "carousel" && (
            <button
              onClick={handleGenerateAll}
              disabled={
                !project.referenceImageId ||
                !project.productImageId ||
                generating
              }
              className="w-full py-2 border border-blue-500 text-blue-700 rounded-lg font-medium hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              Сгенерировать все {carouselCount} слайдов
            </button>
          )}

          {(!project.referenceImageId || !project.productImageId) && (
            <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 p-2 rounded">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>Загрузите референс и фото товара для генерации</span>
            </div>
          )}
        </div>
      </div>

      {/* ===== RIGHT PANEL ===== */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Canvas editor fills available space */}
        <div className="flex-1 min-h-0">
          <CanvasEditor
            imageBase64={canvasImageBase64}
            textBlocks={canvasTextBlocks as Array<{
              text: string;
              x: number;
              y: number;
              fontSize: number;
              fontFamily: string;
              fontWeight?: string;
              color?: string;
            }>}
            onSaveTextLayers={saveTextLayers}
          />
        </div>

        {/* Thumbnail strip */}
        {generatedImages && generatedImages.length > 0 && (
          <div className="flex-shrink-0 border-t border-gray-200 bg-white px-4 py-2 flex gap-2 overflow-x-auto">
            {generatedImages.map((img, idx) => (
              <button
                key={img._id}
                onClick={() => handleThumbnailClick(img)}
                className={`flex-shrink-0 w-14 h-14 rounded-md border-2 flex items-center justify-center text-xs font-semibold transition-all ${
                  activeImageId === img._id
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 bg-gray-50 text-gray-600 hover:border-blue-300"
                }`}
                title={
                  img.type === "carousel"
                    ? `Слайд ${img.slot}`
                    : img.type === "main"
                    ? "Главное"
                    : "Рич"
                }
              >
                {img.type === "carousel" ? img.slot : idx + 1}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
