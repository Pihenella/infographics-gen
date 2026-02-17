import React, { useState } from 'react';
import { 
  Upload, Image, Wand2, Download, Copy, ExternalLink, 
  Settings, Plus, ChevronLeft, Eye, Trash2, RefreshCw,
  Layers, Grid, Star, Check, X, Sparkles, AlertCircle
} from 'lucide-react';

export default function InfographicsGen() {
  const [activeProject, setActiveProject] = useState(null);
  const [view, setView] = useState('projects'); // projects, generator
  const [projects, setProjects] = useState([
    { id: 1, name: 'Кроссовки Nike Air Max', status: 'active', images: 5, reference: null },
    { id: 2, name: 'Рюкзак городской', status: 'draft', images: 2, reference: null },
  ]);
  
  // Reference and product images
  const [referenceImage, setReferenceImage] = useState(null);
  const [productImage, setProductImage] = useState(null);
  const [analyzingReference, setAnalyzingReference] = useState(false);
  const [styleAnalysis, setStyleAnalysis] = useState(null);
  
  // Generation settings
  const [generationSettings, setGenerationSettings] = useState({
    type: 'main', // main, carousel, rich
    slot: 1,
    utp: '',
    instructions: ''
  });
  
  const [generating, setGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState([]);

  // Handle file upload
  const handleFileUpload = async (e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target.result;
      
      if (type === 'reference') {
        setReferenceImage({ url: base64, name: file.name });
        // Automatically analyze when reference is uploaded
        await analyzeReferenceStyle(base64);
      } else if (type === 'product') {
        setProductImage({ url: base64, name: file.name });
      }
    };
    reader.readAsDataURL(file);
  };

  // Analyze reference image style using Claude API
  const analyzeReferenceStyle = async (imageBase64) => {
    setAnalyzingReference(true);
    
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2000,
          messages: [{
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: "image/jpeg",
                  data: imageBase64.split(',')[1]
                }
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

Верни JSON формата:
{
  "style": "краткое название стиля",
  "colors": ["#hex1", "#hex2", ...],
  "layout": "описание композиции",
  "typography": "описание типографики",
  "graphics": "описание графических элементов",
  "effects": "описание эффектов",
  "utp_blocks": ["УТП 1", "УТП 2", ...],
  "prompt_template": "детальный промпт для воссоздания этого стиля"
}`
              }
            ]
          }],
        })
      });

      const data = await response.json();
      const textContent = data.content.find(item => item.type === "text")?.text || "";
      
      // Extract JSON from response
      const jsonMatch = textContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]);
        setStyleAnalysis(analysis);
      }
    } catch (error) {
      console.error('Analysis error:', error);
    } finally {
      setAnalyzingReference(false);
    }
  };

  // Generate infographic using reference style
  const generateWithStyle = async () => {
    if (!referenceImage || !productImage) {
      alert('Загрузите референс и фото товара');
      return;
    }

    setGenerating(true);
    
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2000,
          messages: [{
            role: "user",
            content: `Создай промпт для генерации инфографики товара, используя стиль из анализа:

Стиль референса:
${JSON.stringify(styleAnalysis, null, 2)}

Товар: ${activeProject?.name || 'Товар'}
Тип изображения: ${generationSettings.type === 'main' ? 'Главное фото' : 
                   generationSettings.type === 'carousel' ? `Слайд карусели #${generationSettings.slot}` : 
                   'Рич-контент'}
УТП: ${generationSettings.utp || 'не указано'}
Дополнительно: ${generationSettings.instructions || 'нет'}

Создай промпт для Nano Banana Pro, который воссоздаст ТОЧНО ТАКОЙ ЖЕ стиль, композицию, цвета, типографику.

Верни JSON:
{
  "prompt": "детальный промпт на английском",
  "negative_prompt": "что исключить",
  "style_notes": "какие ключевые элементы стиля применены",
  "suggested_text": "текст на русском для инфографики"
}`
          }],
        })
      });

      const data = await response.json();
      const textContent = data.content.find(item => item.type === "text")?.text || "";
      
      const jsonMatch = textContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const genData = JSON.parse(jsonMatch[0]);
        
        // Simulate image generation
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const newImage = {
          id: Date.now(),
          type: generationSettings.type,
          slot: generationSettings.slot,
          prompt: genData.prompt,
          styleNotes: genData.style_notes,
          suggestedText: genData.suggested_text,
          url: `https://placehold.co/800x1200/${styleAnalysis?.colors?.[0]?.replace('#', '') || 'FF6B35'}/white?text=${encodeURIComponent(activeProject?.name || 'Инфографика')}`,
          createdAt: new Date().toISOString()
        };

        setGeneratedImages(prev => [newImage, ...prev]);
      }
    } catch (error) {
      console.error('Generation error:', error);
    } finally {
      setGenerating(false);
    }
  };

  // Projects List View (Figma-style)
  const ProjectsList = () => (
    <div className="h-screen flex flex-col bg-white">
      {/* Top Bar */}
      <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <span className="text-white font-bold text-sm">IG</span>
          </div>
          <h1 className="text-lg font-semibold text-gray-900">InfographicsGen</h1>
        </div>
        <button
          onClick={() => {
            const newProject = {
              id: Date.now(),
              name: 'Новый товар',
              status: 'draft',
              images: 0,
              reference: null
            };
            setProjects([newProject, ...projects]);
            setActiveProject(newProject);
            setView('generator');
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Новый проект
        </button>
      </div>

      {/* Projects Grid */}
      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-7xl">
          {projects.map(project => (
            <div
              key={project.id}
              onClick={() => {
                setActiveProject(project);
                setView('generator');
              }}
              className="border border-gray-200 rounded-lg p-4 hover:border-blue-500 hover:shadow-sm transition-all cursor-pointer bg-white"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">{project.name}</h3>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      project.status === 'active' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {project.status === 'active' ? 'Активный' : 'Черновик'}
                    </span>
                    {project.reference && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-purple-100 text-purple-700">
                        Референс
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <Image className="w-4 h-4" />
                  <span>{project.images}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // Generator View (Figma-style)
  const GeneratorView = () => (
    <div className="h-screen flex bg-gray-50">
      {/* Left Panel - Controls */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 px-4 py-3 flex items-center gap-2">
          <button
            onClick={() => setView('projects')}
            className="p-1.5 hover:bg-gray-100 rounded transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex-1">
            <h2 className="font-semibold text-gray-900 text-sm">
              {activeProject?.name}
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
              
              {!referenceImage ? (
                <label className="block border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, 'reference')}
                    className="hidden"
                  />
                  <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-700">Загрузить референс</p>
                  <p className="text-xs text-gray-500 mt-1">PNG, JPG до 10MB</p>
                </label>
              ) : (
                <div className="space-y-3">
                  <div className="relative group">
                    <img 
                      src={referenceImage.url} 
                      alt="Reference"
                      className="w-full rounded-lg border border-gray-200"
                    />
                    <button
                      onClick={() => {
                        setReferenceImage(null);
                        setStyleAnalysis(null);
                      }}
                      className="absolute top-2 right-2 p-1.5 bg-white rounded-md shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>

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
                          <span className="font-medium">Стиль:</span> {styleAnalysis.style}
                        </div>
                        {styleAnalysis.colors && (
                          <div>
                            <span className="font-medium">Цвета:</span>
                            <div className="flex gap-1 mt-1">
                              {styleAnalysis.colors.slice(0, 5).map((color, i) => (
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
                        {styleAnalysis.utp_blocks && styleAnalysis.utp_blocks.length > 0 && (
                          <div>
                            <span className="font-medium">УТП на референсе:</span>
                            <ul className="mt-1 space-y-0.5">
                              {styleAnalysis.utp_blocks.slice(0, 3).map((utp, i) => (
                                <li key={i} className="text-xs">• {utp}</li>
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
              
              {!productImage ? (
                <label className="block border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, 'product')}
                    className="hidden"
                  />
                  <Image className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-700">Загрузить товар</p>
                  <p className="text-xs text-gray-500 mt-1">PNG без фона</p>
                </label>
              ) : (
                <div className="relative group">
                  <img 
                    src={productImage.url} 
                    alt="Product"
                    className="w-full rounded-lg border border-gray-200 bg-gray-50"
                  />
                  <button
                    onClick={() => setProductImage(null)}
                    className="absolute top-2 right-2 p-1.5 bg-white rounded-md shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
              )}
            </div>

            {/* Type Selection */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                Тип изображения
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'main', label: 'Главное', icon: Star },
                  { id: 'carousel', label: 'Карусель', icon: Layers },
                  { id: 'rich', label: 'Рич', icon: Grid }
                ].map(type => {
                  const Icon = type.icon;
                  const isActive = generationSettings.type === type.id;
                  return (
                    <button
                      key={type.id}
                      onClick={() => setGenerationSettings({...generationSettings, type: type.id})}
                      className={`p-2.5 rounded-md border transition-all text-xs font-medium ${
                        isActive
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 text-gray-700 hover:border-gray-300'
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
            {generationSettings.type === 'carousel' && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                  Номер слайда (1-30)
                </label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={generationSettings.slot}
                  onChange={(e) => setGenerationSettings({
                    ...generationSettings, 
                    slot: Math.max(1, Math.min(30, parseInt(e.target.value) || 1))
                  })}
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
                onChange={(e) => setGenerationSettings({...generationSettings, utp: e.target.value})}
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
                onChange={(e) => setGenerationSettings({...generationSettings, instructions: e.target.value})}
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
            onClick={generateWithStyle}
            disabled={!referenceImage || !productImage || generating}
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
          
          {!referenceImage && (
            <div className="flex items-start gap-2 mt-3 text-xs text-amber-700 bg-amber-50 p-2 rounded">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>Загрузите референс и фото товара для генерации</span>
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

            {generatedImages.length === 0 ? (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
                <Image className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 font-medium mb-1">Пока нет изображений</p>
                <p className="text-sm text-gray-500">
                  Загрузите референс, фото товара и нажмите "Сгенерировать"
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {generatedImages.map(img => (
                  <div key={img.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
                    {/* Image Preview */}
                    <div className="aspect-[2/3] bg-gray-100 relative">
                      <img 
                        src={img.url} 
                        alt="Generated"
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Details */}
                    <div className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                          {img.type === 'main' ? 'Главное фото' : 
                           img.type === 'carousel' ? `Карусель #${img.slot}` : 
                           'Рич-контент'}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(img.createdAt).toLocaleTimeString('ru')}
                        </span>
                      </div>

                      {img.styleNotes && (
                        <div className="text-xs text-gray-700 bg-gray-50 p-2 rounded">
                          <div className="font-medium mb-1">Применённый стиль:</div>
                          <div>{img.styleNotes}</div>
                        </div>
                      )}

                      {img.suggestedText && (
                        <div className="text-xs text-gray-700 bg-purple-50 p-2 rounded border border-purple-100">
                          <div className="font-medium mb-1">Текст для инфографики:</div>
                          <div className="whitespace-pre-line">{img.suggestedText}</div>
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

  return (
    <div className="antialiased" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      {view === 'projects' ? <ProjectsList /> : <GeneratorView />}
    </div>
  );
}
