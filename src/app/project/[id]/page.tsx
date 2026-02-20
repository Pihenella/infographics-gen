"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import {
  Upload,
  Image,
  Wand2,
  Download,
  ChevronLeft,
  Eye,
  X,
  RefreshCw,
  Layers,
  Grid,
  Star,
  Sparkles,
  AlertCircle,
} from "lucide-react";

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
  const analyzeStyle = useAction(api.analyze.analyzeReferenceStyle);
  const generatePrompt = useAction(api.analyze.generatePrompt);

  // Local UI state
  const [referencePreview, setReferencePreview] = useState<string | null>(null);
  const [productPreview, setProductPreview] = useState<string | null>(null);
  const [analyzingReference, setAnalyzingReference] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generationSettings, setGenerationSettings] = useState({
    type: "main" as "main" | "carousel" | "rich",
    slot: 1,
    utp: "",
    instructions: "",
  });

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "reference" | "product"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show preview
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (type === "reference") {
        setReferencePreview(base64);
      } else {
        setProductPreview(base64);
      }
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

    if (type === "reference") {
      await setReferenceImage({ id: projectId, referenceImageId: storageId });
      // Analyze style
      await analyzeReferenceStyleFromFile(file);
    } else {
      await setProductImage({ id: projectId, productImageId: storageId });
    }
  };

  const analyzeReferenceStyleFromFile = async (file: File) => {
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

  const handleGenerate = async () => {
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
      const genData = await generatePrompt({
        styleAnalysis: project.styleAnalysis,
        projectName: project.name,
        type: generationSettings.type,
        slot: generationSettings.slot,
        utp: generationSettings.utp,
        instructions: generationSettings.instructions,
      });

      await createImage({
        projectId,
        type: generationSettings.type,
        slot: generationSettings.slot,
        prompt: genData.prompt,
        styleNotes: genData.style_notes,
        suggestedText: genData.suggested_text,
      });
    } catch (error) {
      console.error("Generation error:", error);
    } finally {
      setGenerating(false);
    }
  };

  const clearReference = () => {
    setReferencePreview(null);
  };

  const clearProduct = () => {
    setProductPreview(null);
  };

  if (!project)
    return (
      <div className="h-screen flex items-center justify-center text-gray-500">
        Загрузка...
      </div>
    );

  const styleAnalysis = project.styleAnalysis as {
    style?: string;
    colors?: string[];
    utp_blocks?: string[];
  } | null;

  return (
    <div className="h-screen flex bg-gray-50">
      {/* Left Panel - Controls */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 px-4 py-3 flex items-center gap-2">
          <button
            onClick={() => router.push("/")}
            className="p-1.5 hover:bg-gray-100 rounded transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex-1">
            <h2 className="font-semibold text-gray-900 text-sm">
              {project.name}
            </h2>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-auto">
          <div className="p-4 space-y-6">
            {/* Reference Upload */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                Референс инфографики
              </label>

              {!referencePreview && !project.referenceImageId ? (
                <label className="block border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, "reference")}
                    className="hidden"
                  />
                  <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-700">
                    Загрузить референс
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    PNG, JPG до 10MB
                  </p>
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
                        onClick={clearReference}
                        className="absolute top-2 right-2 p-1.5 bg-white rounded-md shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-4 h-4 text-gray-600" />
                      </button>
                    </div>
                  )}

                  {analyzingReference && (
                    <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 p-3 rounded-lg">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Анализирую стиль...
                    </div>
                  )}

                  {styleAnalysis && (
                    <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-3 rounded-lg border border-purple-200">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-4 h-4 text-purple-600" />
                        <span className="text-xs font-semibold text-purple-900">
                          Стиль распознан
                        </span>
                      </div>
                      <div className="space-y-2 text-xs text-purple-800">
                        <div>
                          <span className="font-medium">Стиль:</span>{" "}
                          {styleAnalysis.style}
                        </div>
                        {styleAnalysis.colors && (
                          <div>
                            <span className="font-medium">Цвета:</span>
                            <div className="flex gap-1 mt-1">
                              {styleAnalysis.colors
                                .slice(0, 5)
                                .map((color, i) => (
                                  <div
                                    key={i}
                                    className="w-6 h-6 rounded border border-white shadow-sm"
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
                                    <li key={i} className="text-xs">
                                      &#8226; {utp}
                                    </li>
                                  ))}
                              </ul>
                            </div>
                          )}
                      </div>
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
                <label className="block border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, "product")}
                    className="hidden"
                  />
                  <Image className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-700">
                    Загрузить товар
                  </p>
                  <p className="text-xs text-gray-500 mt-1">PNG без фона</p>
                </label>
              ) : (
                <div className="relative group">
                  {productPreview && (
                    <>
                      <img
                        src={productPreview}
                        alt="Product"
                        className="w-full rounded-lg border border-gray-200 bg-gray-50"
                      />
                      <button
                        onClick={clearProduct}
                        className="absolute top-2 right-2 p-1.5 bg-white rounded-md shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-4 h-4 text-gray-600" />
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Type Selection */}
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
                        setGenerationSettings({
                          ...generationSettings,
                          type: type.id,
                        })
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

            {/* Carousel Slot */}
            {generationSettings.type === "carousel" && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                  Номер слайда (1-30)
                </label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={generationSettings.slot}
                  onChange={(e) =>
                    setGenerationSettings({
                      ...generationSettings,
                      slot: Math.max(
                        1,
                        Math.min(30, parseInt(e.target.value) || 1)
                      ),
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
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
                  setGenerationSettings({
                    ...generationSettings,
                    utp: e.target.value,
                  })
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
                  setGenerationSettings({
                    ...generationSettings,
                    instructions: e.target.value,
                  })
                }
                placeholder="Особые требования..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>
          </div>
        </div>

        {/* Generate Button */}
        <div className="border-t border-gray-200 p-4">
          <button
            onClick={handleGenerate}
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
                Сгенерировать в стиле референса
              </>
            )}
          </button>

          {!project.referenceImageId && (
            <div className="flex items-start gap-2 mt-3 text-xs text-amber-700 bg-amber-50 p-2 rounded">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                Загрузите референс и фото товара для генерации
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Results */}
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          <div className="max-w-4xl mx-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Сгенерированные изображения
            </h3>

            {!generatedImages || generatedImages.length === 0 ? (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
                <Image className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 font-medium mb-1">
                  Пока нет изображений
                </p>
                <p className="text-sm text-gray-500">
                  Загрузите референс, фото товара и нажмите
                  &quot;Сгенерировать&quot;
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {generatedImages.map((img) => (
                  <div
                    key={img._id}
                    className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
                  >
                    {/* Details */}
                    <div className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                          {img.type === "main"
                            ? "Главное фото"
                            : img.type === "carousel"
                              ? `Карусель #${img.slot}`
                              : "Рич-контент"}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(img.createdAt).toLocaleTimeString("ru")}
                        </span>
                      </div>

                      {img.styleNotes && (
                        <div className="text-xs text-gray-700 bg-gray-50 p-2 rounded">
                          <div className="font-medium mb-1">
                            Применённый стиль:
                          </div>
                          <div>{img.styleNotes}</div>
                        </div>
                      )}

                      {img.suggestedText && (
                        <div className="text-xs text-gray-700 bg-purple-50 p-2 rounded border border-purple-100">
                          <div className="font-medium mb-1">
                            Текст для инфографики:
                          </div>
                          <div className="whitespace-pre-line">
                            {img.suggestedText}
                          </div>
                        </div>
                      )}

                      {img.prompt && (
                        <div className="text-xs text-gray-700 bg-green-50 p-2 rounded border border-green-100">
                          <div className="font-medium mb-1">Промпт:</div>
                          <div className="whitespace-pre-line">
                            {img.prompt}
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2 pt-2">
                        <button className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5">
                          <Eye className="w-4 h-4" />
                          Просмотр
                        </button>
                        <button className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5">
                          <Download className="w-4 h-4" />
                          Скачать
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
