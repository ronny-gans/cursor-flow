import React, { useState } from 'react';
import { PhysicsConfig, AnimationPreset, BackgroundStyle, ZoomEvent, AspectRatio, TitleStyle, TitleTextAlign } from '../types';
import { PHYSICS_PRESETS } from '../constants';
import { 
  Sliders, Activity, Sparkles, Camera, Image, 
  Grid3X3, Palette, Monitor, Plus, Trash2, Wand2, 
  Smartphone, LayoutTemplate, Keyboard, Clock, X, Layers, Move3d, Zap,
  Type, Crop, PanelTop, Maximize, Loader2
} from 'lucide-react';

interface PhysicsControlsProps {
  config: PhysicsConfig;
  onChange: (newConfig: PhysicsConfig) => void;
  currentPreset: AnimationPreset;
  onPresetChange: (preset: AnimationPreset) => void;
  blurEnabled: boolean;
  setBlurEnabled: (val: boolean) => void;
  background: BackgroundStyle;
  setBackground: (val: BackgroundStyle) => void;
  backgroundBlur: number;
  setBackgroundBlur: (val: number) => void;
  showCamera: boolean;
  setShowCamera: (val: boolean) => void;
  onAddZoom: () => void;
  onClearZooms: () => void;
  onAutoGenerateZooms: () => void;
  zoomCount: number;
  timelineDuration: number;
  zooms: ZoomEvent[];
  selectedZoomId: string | null;
  onSelectZoom: (id: string | null) => void;
  onUpdateZoom: (id: string, updates: Partial<ZoomEvent>) => void;
  onDeleteZoom: (id: string) => void;
  aspectRatio: AspectRatio;
  setAspectRatio: (val: AspectRatio) => void;
  showWindowFrame: boolean;
  setShowWindowFrame: (val: boolean) => void;
  showKeystrokes: boolean;
  setShowKeystrokes: (val: boolean) => void;
  onAddTitleClip: (text: string, style: TitleStyle) => void;
  contentScale: number;
  setContentScale: (val: number) => void;
  borderRadius: number;
  setBorderRadius: (val: number) => void;
  isAnalyzingZooms: boolean;
}

const ControlSlider = ({ label, value, min, max, step = 0.1, onChange }: { label: string, value: number, min: number, max: number, step?: number, onChange: (val: number) => void }) => (
  <div className="mb-4">
    <div className="flex justify-between text-xs font-medium text-zinc-400 mb-1">
      <span>{label}</span>
      <span className="font-mono text-zinc-300">{value.toFixed(2)}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400"
    />
  </div>
);

type Tab = 'canvas' | 'overlays' | 'zoom';

const GRADIENTS: Record<BackgroundStyle, string> = {
  grid: '#0c0c0e',
  solid: '#18181b',
  sunset: 'linear-gradient(135deg, #f59e0b 0%, #d946ef 100%)',
  ocean: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
  cotton_candy: 'linear-gradient(135deg, #f472b6 0%, #60a5fa 100%)',
  aurora: 'linear-gradient(135deg, #34d399 0%, #8b5cf6 100%)',
  midnight: 'linear-gradient(135deg, #0f172a 0%, #312e81 100%)',
  gunmetal: 'linear-gradient(135deg, #374151 0%, #111827 100%)',
  iridescent: 'linear-gradient(135deg, #f0abfc 0%, #818cf8 50%, #2dd4bf 100%)',
  peachy: 'linear-gradient(135deg, #fb7185 0%, #fdba74 100%)',
  cd: 'linear-gradient(135deg, #e0e7ff 0%, #a5b4fc 100%)',
  hollywood: 'linear-gradient(135deg, #4f46e5 0%, #ec4899 100%)',
  sublime: 'linear-gradient(135deg, #bef264 0%, #22c55e 100%)',
  flamingo: 'linear-gradient(135deg, #f43f5e 0%, #fcd34d 100%)',
};

export const PhysicsControls: React.FC<PhysicsControlsProps> = React.memo(({
  config, onChange, currentPreset, onPresetChange, blurEnabled, setBlurEnabled,
  background, setBackground, backgroundBlur, setBackgroundBlur, showCamera, setShowCamera,
  onAddZoom, onClearZooms, onAutoGenerateZooms, zoomCount, timelineDuration, zooms, selectedZoomId, onSelectZoom, onUpdateZoom, onDeleteZoom,
  aspectRatio, setAspectRatio, showWindowFrame, setShowWindowFrame, showKeystrokes, setShowKeystrokes,
  onAddTitleClip, contentScale, setContentScale, borderRadius, setBorderRadius, isAnalyzingZooms
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('canvas');

  const [titleText, setTitleText] = useState('');
  const [titleFontFamily, setTitleFontFamily] = useState('Inter, ui-sans-serif, system-ui');
  const [titleFontSize, setTitleFontSize] = useState(64);
  const [titleTextAlign, setTitleTextAlign] = useState<TitleTextAlign>('center');
  const [titleTextColor, setTitleTextColor] = useState('#ffffff');
  const [titleBackground, setTitleBackground] = useState('#0b0b10');
  const [titlePosX, setTitlePosX] = useState(50);
  const [titlePosY, setTitlePosY] = useState(50);

  const handleAddTitleSlide = () => {
      const text = titleText.trim();
      if (!text) return;
      const style: TitleStyle = {
          fontFamily: titleFontFamily,
          fontSize: titleFontSize,
          textAlign: titleTextAlign,
          textColor: titleTextColor,
          background: titleBackground,
          posX: titlePosX,
          posY: titlePosY,
      };
      onAddTitleClip(text, style);
      setTitlePosX(50);
      setTitlePosY(50);
  };

  const selectedZoom = zooms.find(z => z.id === selectedZoomId);
  const aspectRatios: AspectRatio[] = ['Auto', '16:9', '9:16', '1:1', '4:3', '21:9'];

  return (
    <div className="w-80 bg-zinc-900 border-l border-zinc-800 h-full flex flex-col">
      <div className="flex border-b border-zinc-800">
        <button onClick={() => setActiveTab('canvas')} className={`flex-1 py-3 text-xs font-medium flex flex-col items-center gap-1.5 transition-colors border-b-2 ${activeTab === 'canvas' ? 'text-indigo-400 border-indigo-500 bg-zinc-800/50' : 'text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-zinc-800/30'}`}>
          <LayoutTemplate className="w-4 h-4" /> Canvas
        </button>
        <button onClick={() => setActiveTab('overlays')} className={`flex-1 py-3 text-xs font-medium flex flex-col items-center gap-1.5 transition-colors border-b-2 ${activeTab === 'overlays' ? 'text-indigo-400 border-indigo-500 bg-zinc-800/50' : 'text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-zinc-800/30'}`}>
          <Layers className="w-4 h-4" /> Overlays
        </button>
        <button onClick={() => setActiveTab('zoom')} className={`flex-1 py-3 text-xs font-medium flex flex-col items-center gap-1.5 transition-colors border-b-2 ${activeTab === 'zoom' ? 'text-indigo-400 border-indigo-500 bg-zinc-800/50' : 'text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-zinc-800/30'}`}>
          <Zap className="w-4 h-4" /> Zoom
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        
        {/* CANVAS TAB - Backgrounds, Dimensions, Padding */}
        {activeTab === 'canvas' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
             <div>
               <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 block">Wallpaper</label>
               <div className="grid grid-cols-4 gap-2 mb-4">
                  {(Object.keys(GRADIENTS) as BackgroundStyle[]).map((bg) => (
                    <button 
                      key={bg}
                      onClick={() => setBackground(bg)}
                      className={`h-8 rounded-md border transition-all relative overflow-hidden ${background === bg ? 'ring-2 ring-indigo-500 border-white/50' : 'border-zinc-700 opacity-80 hover:opacity-100 hover:border-zinc-500'}`}
                      style={{ background: GRADIENTS[bg] }}
                      title={bg.charAt(0).toUpperCase() + bg.slice(1)}
                    >
                        {bg === 'grid' && <Grid3X3 className="w-3 h-3 mx-auto text-white/50" />}
                    </button>
                  ))}
               </div>
               <ControlSlider label="Background Blur (px)" value={backgroundBlur} min={0} max={20} step={1} onChange={setBackgroundBlur} />
             </div>

             <div className="h-px bg-zinc-800 w-full" />

             <div>
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 block">Aspect Ratio</label>
                <div className="flex flex-wrap gap-2 mb-4">
                   {aspectRatios.map(ratio => (
                      <button 
                        key={ratio}
                        onClick={() => setAspectRatio(ratio)} 
                        className={`flex-1 min-w-[30%] flex items-center justify-center gap-2 py-1.5 rounded-md text-xs transition-all ${aspectRatio === ratio ? 'bg-zinc-600 text-white shadow' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-300 hover:bg-zinc-700'}`}
                      >
                        {ratio === '9:16' ? <Smartphone className="w-3.5 h-3.5" /> : ratio === 'Auto' ? <Maximize className="w-3.5 h-3.5" /> : <Monitor className="w-3.5 h-3.5" />} 
                        {ratio}
                      </button>
                   ))}
                </div>
             </div>

             <div>
                <div className="flex items-center gap-2 mb-3">
                    <Crop className="w-3.5 h-3.5 text-zinc-500" />
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Layout</label>
                </div>
                <div className="bg-zinc-950/50 p-3 rounded-lg border border-zinc-800/50 space-y-4">
                    <ControlSlider label="Padding / Zoom" value={contentScale} min={0.5} max={10.0} step={0.01} onChange={setContentScale} />
                    <ControlSlider label="Corner Radius" value={borderRadius} min={0} max={60} step={1} onChange={setBorderRadius} />
                </div>
             </div>
          </div>
        )}

        {/* OVERLAYS TAB - Cursor, Window, Camera, Generators */}
        {activeTab === 'overlays' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
             

             {/* UI Elements */}
             <div>
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 block">Window & UI</label>
                <div className="space-y-2">
                   <label className="flex items-center justify-between p-2 rounded hover:bg-zinc-800/50 cursor-pointer border border-zinc-800 bg-zinc-950/30">
                     <span className="text-xs text-zinc-300 flex items-center gap-2"><PanelTop className="w-3.5 h-3.5 text-zinc-400" /> macOS Window Frame</span>
                     <input type="checkbox" checked={showWindowFrame} onChange={(e) => setShowWindowFrame(e.target.checked)} className="accent-indigo-500" />
                   </label>

                   <label className="flex items-center justify-between p-2 rounded hover:bg-zinc-800/50 cursor-pointer border border-zinc-800 bg-zinc-950/30">
                     <span className="text-xs text-zinc-300 flex items-center gap-2"><Camera className="w-3.5 h-3.5 text-rose-400" /> Camera Bubble (PiP)</span>
                     <input type="checkbox" checked={showCamera} onChange={(e) => setShowCamera(e.target.checked)} className="accent-indigo-500" />
                   </label>

                   <label className="flex items-center justify-between p-2 rounded hover:bg-zinc-800/50 cursor-pointer border border-zinc-800 bg-zinc-950/30">
                     <span className="text-xs text-zinc-300 flex items-center gap-2"><Keyboard className="w-3.5 h-3.5 text-emerald-400" /> Keystroke Visualizer</span>
                     <input type="checkbox" checked={showKeystrokes} onChange={(e) => setShowKeystrokes(e.target.checked)} className="accent-indigo-500" />
                   </label>
                </div>
             </div>

             <div className="h-px bg-zinc-800 w-full" />
             
             {/* Title Slide Studio */}
             <div>
                <label className="text-xs font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-indigo-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                   <Type className="w-3 h-3 text-pink-500" /> Title Slide Studio
                </label>
                <div className="bg-zinc-950/50 rounded-lg border border-zinc-800/50 p-3 space-y-4">
                   <div>
                      <label className="text-[10px] text-zinc-500 font-medium mb-1 block">Content</label>
                      <textarea value={titleText} onChange={(e) => setTitleText(e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-xs text-zinc-300 focus:outline-none focus:border-pink-500 resize-none h-20" placeholder="Big Update" />
                   </div>

                   <div className="grid grid-cols-2 gap-2">
                      <div>
                         <label className="text-[10px] text-zinc-500 font-medium mb-1 block">Font</label>
                         <select value={titleFontFamily} onChange={(e) => setTitleFontFamily(e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-xs text-zinc-300 focus:outline-none focus:border-zinc-500">
                            <option value="Inter, ui-sans-serif, system-ui">Inter (Sans)</option>
                            <option value="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace">Mono</option>
                         </select>
                      </div>
                      <div>
                         <label className="text-[10px] text-zinc-500 font-medium mb-1 block">Size (px)</label>
                         <input type="number" min={12} max={160} value={titleFontSize} onChange={(e) => setTitleFontSize(Number(e.target.value))} className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-xs text-zinc-300 focus:outline-none focus:border-zinc-500" />
                      </div>
                   </div>

                   <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                         <button onClick={() => setTitleTextAlign('left')} className={`h-8 w-10 rounded border text-xs ${titleTextAlign === 'left' ? 'bg-zinc-700 border-zinc-500 text-white' : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-zinc-200'}`}>L</button>
                         <button onClick={() => setTitleTextAlign('center')} className={`h-8 w-10 rounded border text-xs ${titleTextAlign === 'center' ? 'bg-zinc-700 border-zinc-500 text-white' : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-zinc-200'}`}>C</button>
                         <button onClick={() => setTitleTextAlign('right')} className={`h-8 w-10 rounded border text-xs ${titleTextAlign === 'right' ? 'bg-zinc-700 border-zinc-500 text-white' : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-zinc-200'}`}>R</button>
                      </div>
                      <div className="flex items-center gap-2">
                         <div className="h-8 w-8 rounded border border-zinc-700 bg-zinc-900 flex items-center justify-center">
                            <input type="color" value={titleTextColor} onChange={(e) => setTitleTextColor(e.target.value)} className="h-6 w-6 bg-transparent" />
                         </div>
                         <span className="text-[10px] text-zinc-500 font-medium">Text</span>
                      </div>
                   </div>

                   <div>
                      <label className="text-[10px] text-zinc-500 font-medium mb-2 block">Slide Background</label>
                      <div className="flex flex-wrap gap-2">
                         {[
                            { key: 'black', bg: '#0b0b10' },
                            { key: 'blue', bg: 'linear-gradient(135deg, #1e3a8a 0%, #0b1220 100%)' },
                            { key: 'purple', bg: 'linear-gradient(135deg, #6d28d9 0%, #111827 100%)' },
                            { key: 'sun', bg: 'linear-gradient(135deg, #f97316 0%, #db2777 100%)' },
                            { key: 'green', bg: 'linear-gradient(135deg, #065f46 0%, #111827 100%)' },
                            { key: 'lines', bg: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.08) 0, rgba(255,255,255,0.08) 6px, rgba(255,255,255,0) 6px, rgba(255,255,255,0) 12px), #0b0b10' },
                         ].map(({ key, bg }) => (
                            <button key={key} onClick={() => setTitleBackground(bg)} className={`h-8 w-8 rounded border transition-all ${titleBackground === bg ? 'ring-2 ring-pink-500 border-white/50' : 'border-zinc-700 hover:border-zinc-500'}`} style={{ background: bg }} />
                         ))}
                      </div>
                   </div>

                   <div>
                      <label className="text-[10px] text-zinc-500 font-medium mb-1 block">Position</label>
                      <div className="space-y-3">
                         <div>
                            <div className="flex justify-between text-[10px] text-zinc-500 mb-1"><span>X</span><span className="font-mono text-zinc-400">{titlePosX}</span></div>
                            <input type="range" min={0} max={100} step={1} value={titlePosX} onChange={(e) => setTitlePosX(Number(e.target.value))} className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-pink-500" />
                         </div>
                         <div>
                            <div className="flex justify-between text-[10px] text-zinc-500 mb-1"><span>Y</span><span className="font-mono text-zinc-400">{titlePosY}</span></div>
                            <input type="range" min={0} max={100} step={1} value={titlePosY} onChange={(e) => setTitlePosY(Number(e.target.value))} className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-pink-500" />
                         </div>
                      </div>
                   </div>

                   <button onClick={handleAddTitleSlide} disabled={!titleText.trim()} className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-pink-600 to-indigo-600 text-white py-2.5 rounded-md text-xs font-medium transition-all disabled:opacity-50">
                      <Plus className="w-4 h-4" /> Add Title Slide
                   </button>
                </div>
             </div>
          </div>
        )}

        {/* ZOOM TAB - Timeline & Keyframes */}
        {activeTab === 'zoom' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="bg-zinc-950/50 rounded-lg border border-zinc-800 p-4 space-y-4 relative">
               <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Timeline Actions</span>
                  <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">{zoomCount} Keyframes</span>
               </div>
               {selectedZoom ? (
                  <div className="animate-in fade-in zoom-in-95 duration-200">
                      <div className="flex items-center justify-between mb-4 border-b border-zinc-700/50 pb-2">
                          <span className="text-xs font-semibold text-indigo-400 flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Edit Selected Zoom</span>
                          <div className="flex gap-1">
                               <button onClick={() => onDeleteZoom(selectedZoom.id)} className="p-1.5 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 rounded transition-colors" title="Delete Zoom"><Trash2 className="w-4 h-4" /></button>
                               <button onClick={() => onSelectZoom(null)} className="p-1.5 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded transition-colors" title="Close"><X className="w-4 h-4" /></button>
                          </div>
                      </div>
                      <ControlSlider label="Start Time (s)" value={selectedZoom.startTime} min={0} max={Math.max(0, timelineDuration - 0.5)} onChange={(val) => onUpdateZoom(selectedZoom.id, { startTime: val })} />
                      <ControlSlider label="Duration (s)" value={selectedZoom.duration} min={0.5} max={10} onChange={(val) => onUpdateZoom(selectedZoom.id, { duration: val })} />
                      <ControlSlider label="Scale Factor (x)" value={selectedZoom.scale} min={1.1} max={3.0} onChange={(val) => onUpdateZoom(selectedZoom.id, { scale: val })} />
                      <button onClick={() => onSelectZoom(null)} className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-2 rounded text-xs transition-colors mt-2">Done Editing</button>
                  </div>
               ) : (
                   <div className="space-y-3">
                      <p className="text-xs text-zinc-500 italic">Select a zoom block on the timeline or double-click the canvas to edit, or use the tools below.</p>
                      <button onClick={onAddZoom} className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-md text-xs font-medium transition-colors shadow-lg shadow-indigo-500/20"><Plus className="w-4 h-4" /> Add Zoom at Playhead</button>
                      <div className="grid grid-cols-2 gap-2">
                          <button onClick={onAutoGenerateZooms} disabled={isAnalyzingZooms} className={`flex items-center justify-center gap-2 py-2.5 rounded-md text-xs transition-colors border ${isAnalyzingZooms ? 'bg-zinc-900 border-zinc-800 text-zinc-500' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700'}`}>
                              {isAnalyzingZooms ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                              {isAnalyzingZooms ? 'AI Analyzing...' : 'Auto-Gen'}
                          </button>
                          <button onClick={onClearZooms} className="flex items-center justify-center gap-2 bg-zinc-800 hover:bg-rose-900/30 text-zinc-300 hover:text-rose-400 py-2.5 rounded-md text-xs transition-colors border border-zinc-700 hover:border-rose-800"><Trash2 className="w-3.5 h-3.5" /> Clear All</button>
                      </div>
                   </div>
               )}
            </div>
            <div className="p-4 bg-zinc-800/30 rounded-lg border border-zinc-800/50">
               <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Pro Tip</h4>
               <p className="text-[11px] text-zinc-400 leading-relaxed">Double-click anywhere on the canvas preview to instantly create a zoom targeting that specific area.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
