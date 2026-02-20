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
const FONTS = [
  "Inter",
  "Arial",
  "Georgia",
  "Roboto",
  "Montserrat",
  "Playfair Display",
];

export default function CanvasEditor({
  imageBase64,
  textBlocks,
  onSaveTextLayers,
}: Props) {
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

    const applySelectedText = (obj: fabric.FabricObject | undefined) => {
      if (obj instanceof fabric.IText) {
        setSelectedText(obj);
        setFontSize((obj.fontSize as number) ?? 24);
        setFontFamily((obj.fontFamily as string) ?? "Inter");
        setTextColor((obj.fill as string) ?? "#ffffff");
      }
    };

    canvas.on("selection:created", (e) => applySelectedText(e.selected?.[0]));
    canvas.on("selection:updated", (e) => applySelectedText(e.selected?.[0]));
    canvas.on("selection:cleared", () => setSelectedText(null));
    canvas.on("object:modified", () => {
      if (onSaveTextLayers) onSaveTextLayers(canvas.toJSON());
    });

    return () => {
      canvas.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || !imageBase64) return;
    fabric.FabricImage.fromURL(`data:image/png;base64,${imageBase64}`).then(
      (img) => {
        img.scaleToWidth(CANVAS_SIZE);
        img.scaleToHeight(CANVAS_SIZE);
        img.set({ selectable: false, evented: false });
        canvas.backgroundImage = img;
        canvas.renderAll();
      }
    );
  }, [imageBase64]);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    // Remove existing IText objects using getObjects with type filter
    canvas.getObjects("IText").forEach((o) => canvas.remove(o));
    if (!textBlocks.length) return;
    textBlocks.forEach((block) => {
      const text = new fabric.IText(block.text, {
        left: block.x,
        top: block.y,
        fontSize: block.fontSize,
        fontFamily: block.fontFamily || "Inter",
        fontWeight: block.fontWeight || "normal",
        fill: block.color || "#ffffff",
        shadow: new fabric.Shadow({
          color: "rgba(0,0,0,0.5)",
          offsetX: 1,
          offsetY: 1,
          blur: 4,
        }),
      });
      canvas.add(text);
    });
    canvas.renderAll();
    if (onSaveTextLayers) onSaveTextLayers(canvas.toJSON());
  }, [textBlocks, onSaveTextLayers]);

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

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-200 bg-white flex-shrink-0 min-h-[44px]">
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
              {FONTS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
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
              onClick={() =>
                updateSelected({
                  fontWeight:
                    selectedText.fontWeight === "bold" ? "normal" : "bold",
                })
              }
              className={`p-1.5 rounded border ${
                selectedText.fontWeight === "bold"
                  ? "bg-gray-200 border-gray-400"
                  : "border-gray-300"
              }`}
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() =>
                updateSelected({
                  fontStyle:
                    selectedText.fontStyle === "italic" ? "normal" : "italic",
                })
              }
              className={`p-1.5 rounded border ${
                selectedText.fontStyle === "italic"
                  ? "bg-gray-200 border-gray-400"
                  : "border-gray-300"
              }`}
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
            />
            <span className="text-xs text-gray-400 ml-2">
              Кликни дважды для редактирования
            </span>
          </>
        ) : (
          <span className="text-xs text-gray-400">
            {imageBase64
              ? "Выбери текстовый блок для редактирования"
              : "Сгенерируй изображение"}
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
      <div className="flex-1 overflow-auto bg-gray-100 flex items-start justify-center p-4">
        <div
          className="shadow-xl"
          style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}
        >
          <canvas ref={canvasRef} />
        </div>
      </div>
    </div>
  );
}
