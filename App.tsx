
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PhysicsControls } from './components/PhysicsControls';
import { EditorCanvas } from './components/EditorCanvas';
import { PhysicsConfig, AnimationPreset, BackgroundStyle, ZoomEvent, VideoClip, DragState, ProjectState, AspectRatio, TitleStyle } from './types';
import { INITIAL_CONFIG } from './constants';
import { Video, Play, Pause, Scissors, Trash2, Circle, Square, Download, Loader2, Save, FolderOpen, ChevronDown, X, Sparkles, Cpu } from 'lucide-react';
import { analyzeVideoForZooms } from './services/geminiService';
import { checkBackendHealth, processVideoWithProgress, ProcessOptions } from './services/videoProcessingService';

const DEFAULT_DURATION = 15; // seconds
const STORAGE_KEY = 'cursor_flow_project_v1';
const PROJECT_FILE_PATH_KEY = 'cursor_flow_project_file_path_v1';

// --- MEMOIZED SUB-COMPONENTS ---

const Playhead = React.memo(({ currentTime, scale, onPointerDown }: { currentTime: number, scale: number, onPointerDown: (e: React.PointerEvent) => void }) => (
  <div 
      className="absolute top-0 bottom-0 z-50 group cursor-col-resize flex justify-center w-6 -ml-3 pointer-events-auto"
      onPointerDown={onPointerDown}
      style={{ left: `${16 + currentTime * scale}px` }} 
  >
      {/* Visual Line */}
      <div className="h-full w-[1.5px] bg-red-500 relative shadow-[0_0_4px_rgba(239,68,68,0.5)]">
         {/* Handle Head */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-red-500 rotate-45 -mt-1.5 shadow-md transition-transform group-hover:scale-125"></div>
      </div>
  </div>
));

interface TimelineTracksProps {
  clips: VideoClip[];
  zooms: ZoomEvent[];
  selectedClipId: string | null;
  selectedZoomId: string | null;
  duration: number;
  scale: number;
  contentWidth: number;
  onScrubStart: (e: React.PointerEvent<HTMLDivElement>) => void;
  onClipInteraction: (e: React.PointerEvent, id: string, mode: 'move' | 'resize', start: number, dur: number) => void;
  onZoomInteraction: (e: React.PointerEvent, id: string, mode: 'move' | 'resize', start: number, dur: number) => void;
}

const TimelineTracks = React.memo(({ 
  clips, zooms, selectedClipId, selectedZoomId, duration, 
  scale, contentWidth,
  onScrubStart, onClipInteraction, onZoomInteraction 
}: TimelineTracksProps) => {
  return (
    <div className="p-4 relative" style={{ width: contentWidth }}>
      <div className="absolute inset-0 pointer-events-none opacity-20" style={{ backgroundImage: 'linear-gradient(90deg, #27272a 1px, transparent 1px)', backgroundSize: `${scale}px 100%` }}></div>

      {/* Track 1: Video & Titles */}
      <div className="relative h-14 bg-zinc-800/20 rounded mb-2 border border-zinc-700/30 flex items-center overflow-hidden">
        <span className="absolute left-2 text-[10px] text-zinc-500 font-bold z-10 pointer-events-none select-none">VIDEO</span>
        
        <div 
            className="absolute inset-0 cursor-pointer" 
            onPointerDown={onScrubStart}
        >
            {clips.map((clip) => {
                const left = 16 + clip.startTime * scale;
                const width = Math.max(2, clip.duration * scale);
                const isSelected = selectedClipId === clip.id;
                const isTitle = clip.type === 'title';

                const baseClasses = isTitle 
                    ? (isSelected ? 'bg-pink-500/80 border-pink-300' : 'bg-pink-600/40 border-pink-500/50 hover:bg-pink-600/60')
                    : (isSelected ? 'bg-sky-500/80 border-sky-300' : 'bg-sky-600/40 border-sky-500/50 hover:bg-sky-600/60');

                return (
                    <div 
                        key={clip.id}
                        className={`absolute top-1 bottom-1 rounded flex items-center overflow-hidden transition-colors group z-20 border shadow-md ${baseClasses}`}
                        style={{ 
                            left: `${left}px`, 
                            width: `${width}px`,
                            cursor: 'grab'
                        }}
                        onPointerDown={(e) => onClipInteraction(e, clip.id, 'move', clip.startTime, clip.duration)}
                    >
                        <span className="text-[10px] text-white/90 font-medium ml-2 truncate pointer-events-none flex items-center gap-1.5">
                            {isTitle ? <div className="w-3 h-3 bg-white/20 rounded flex items-center justify-center text-[8px]">T</div> : <Video className="w-3 h-3" />}
                            {isTitle ? (clip.text || 'Title') : clip.name}
                        </span>
                        
                        {/* Clip Resize Handle */}
                        <div 
                            className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-white/30 z-30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            onPointerDown={(e) => onClipInteraction(e, clip.id, 'resize', clip.startTime, clip.duration)}
                        >
                            <div className="w-0.5 h-4 bg-white/50 rounded-full"></div>
                        </div>
                    </div>
                )
            })}
        </div>
      </div>

      {/* Track 2: Zooms */}
      <div className="relative h-10 bg-zinc-800/10 rounded mb-2 border border-zinc-700/20 flex items-center overflow-hidden">
        <span className="absolute left-2 text-[10px] text-zinc-600 font-bold z-10 pointer-events-none select-none">ZOOM</span>
        <div className="absolute inset-0 cursor-pointer" onPointerDown={onScrubStart}>
            {zooms.map((zoom) => {
                const left = 16 + zoom.startTime * scale;
                const width = Math.max(2, zoom.duration * scale);
                const isSelected = selectedZoomId === zoom.id;
                return (
                    <div 
                        key={zoom.id}
                        className={`absolute top-1 bottom-1 rounded flex items-center justify-center transition-colors group z-20 ${
                            isSelected 
                            ? 'bg-purple-500/80 border border-purple-300 shadow-lg' 
                            : 'bg-purple-500/30 border border-purple-500/50 hover:bg-purple-500/50'
                        }`}
                        style={{ 
                            left: `${left}px`, 
                            width: `${width}px`,
                            cursor: 'grab'
                        }}
                        onPointerDown={(e) => onZoomInteraction(e, zoom.id, 'move', zoom.startTime, zoom.duration)}
                    >
                        
                        <div 
                            className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-white/30 z-30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            onPointerDown={(e) => onZoomInteraction(e, zoom.id, 'resize', zoom.startTime, zoom.duration)}
                        >
                            <div className="w-0.5 h-4 bg-white/50 rounded-full"></div>
                        </div>
                    </div>
                )
            })}
        </div>
      </div>

      {/* Track 3: Audio */}
      <div 
        className="relative h-10 bg-zinc-800/10 rounded border border-zinc-700/20 flex items-center overflow-hidden cursor-pointer opacity-50" 
        onPointerDown={onScrubStart}
      >
          <span className="absolute left-2 text-[10px] text-zinc-600 font-bold z-10 pointer-events-none select-none">AUDIO</span>
          <svg className="absolute inset-0 h-full w-full opacity-20 pointer-events-none" preserveAspectRatio="none">
            <path d="M0,25 L10,15 L20,35 L30,20 L40,30 L50,15 L60,25 L70,10 L80,40 L90,20 L100,30 L110,15 L120,25 L130,15 L140,35 L150,20 L160,30 L170,15 L180,25" stroke="currentColor" fill="none" className="text-emerald-400" vectorEffect="non-scaling-stroke" />
          </svg>
      </div>
    </div>
  );
});

// --- MAIN APP ---

const App = () => {
  const electronAPI = typeof window !== 'undefined' ? window.electronAPI : undefined;
  const isElectron = !!electronAPI;

  const [config, setConfig] = useState<PhysicsConfig>(INITIAL_CONFIG);
  const [currentPreset, setCurrentPreset] = useState<AnimationPreset>(AnimationPreset.MELLOW);
  const [blurEnabled, setBlurEnabled] = useState(true);
  const [background, setBackground] = useState<BackgroundStyle>('sunset');
  const [backgroundBlur, setBackgroundBlur] = useState(0); 
  const [showCamera, setShowCamera] = useState(false);
  const [contentScale, setContentScale] = useState(0.95); 
  const [borderRadius, setBorderRadius] = useState(20);
  
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('Auto');
  const [showWindowFrame, setShowWindowFrame] = useState(true);
  const [showKeystrokes, setShowKeystrokes] = useState(true);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const isPlayingRef = useRef(false);

  const [isRecording, setIsRecording] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatus, setExportStatus] = useState('');
  const [backendAvailable, setBackendAvailable] = useState<boolean | null>(null);
  const [isCaptureMode, setIsCaptureMode] = useState(false);
  const [projectFilePath, setProjectFilePath] = useState<string | null>(() => {
    try {
      return localStorage.getItem(PROJECT_FILE_PATH_KEY);
    } catch {
      return null;
    }
  });
  const [exportOptions, setExportOptions] = useState<ProcessOptions>({
    cursorStyle: 'fancy',
    cursorSize: 48,
    cursorColor: 'white',
    smooth: true,
    quality: 'high'
  });
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const exportRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const exportCursorDataRef = useRef<{ x: number; y: number; time: number }[]>([]);
  

  const [zooms, setZooms] = useState<ZoomEvent[]>([]);
  const [selectedZoomId, setSelectedZoomId] = useState<string | null>(null);
  const [isAnalyzingZooms, setIsAnalyzingZooms] = useState(false);
  
  const [clips, setClips] = useState<VideoClip[]>([
      { id: '1', startTime: 0, duration: DEFAULT_DURATION, name: 'Demo Project', type: 'video' }
  ]);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);

  const timelineDuration = React.useMemo(() => {
      const clipEnd = clips.reduce((max, c) => Math.max(max, c.startTime + c.duration), 0);
      const zoomEnd = zooms.reduce((max, z) => Math.max(max, z.startTime + z.duration), 0);
      const next = Math.max(DEFAULT_DURATION, clipEnd, zoomEnd);
      return Number.isFinite(next) && next > 0 ? next : DEFAULT_DURATION;
  }, [clips, zooms]);

  const [timelineScale, setTimelineScale] = useState(80);

  const timelineContentWidth = React.useMemo(() => {
      return Math.max(600, Math.ceil(timelineDuration * timelineScale) + 32);
  }, [timelineDuration, timelineScale]);
  
  const [dragState, setDragState] = useState<DragState | null>(null);
  
  const timelineRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number | null>(null);
  const previousTimeRef = useRef<number | null>(null);
  const keyTimeoutRef = useRef<number | null>(null);


  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    if (isCaptureMode) {
      const prev = document.documentElement.style.cursor;
      document.documentElement.style.cursor = 'none';
      return () => {
        document.documentElement.style.cursor = prev;
      };
    }
  }, [isCaptureMode]);

  // Check backend availability on mount
  useEffect(() => {
    checkBackendHealth().then(available => {
      console.log('Backend available:', available);
      setBackendAvailable(available);
    });
  }, []);

  const animate = useCallback((time: number) => {
    if (!isPlayingRef.current) {
        previousTimeRef.current = null;
        return;
    }

    if (previousTimeRef.current != null) {
      const deltaTime = (time - previousTimeRef.current) / 1000;
      setCurrentTime(prev => {
        const next = prev + deltaTime;
        if (next >= timelineDuration) {
           setIsPlaying(false);
           if (exportRecorderRef.current && exportRecorderRef.current.state !== 'inactive') {
               exportRecorderRef.current.stop();
           }
           return 0;
        }
        return next;
      });
    }
    previousTimeRef.current = time;
    requestRef.current = requestAnimationFrame(animate);
  }, [timelineDuration]);

  useEffect(() => {
    if (isPlaying) {
      requestRef.current = requestAnimationFrame(animate);
    } else {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      previousTimeRef.current = null;
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    }
  }, [isPlaying, animate]);

  useEffect(() => {
    if (dragState) {
        const handleMouseMove = (e: MouseEvent) => {
             if (!timelineRef.current) return;
             
             const rect = timelineRef.current.getBoundingClientRect();
             const trackWidth = timelineDuration * timelineScale;
             const relativeX = e.clientX - rect.left + timelineRef.current.scrollLeft - 16;
             
             if (dragState.type === 'playhead') {
                 const clampedX = Math.max(0, Math.min(trackWidth, relativeX));
                 setCurrentTime(clampedX / timelineScale);
                 return;
             }
             
             const pixelDelta = relativeX - dragState.startX;
             const timeDelta = pixelDelta / timelineScale;
             
             if (dragState.type === 'zoom') {
                setZooms(prev => prev.map(z => {
                    if (z.id !== dragState.id) return z;
                    
                    if (dragState.mode === 'move') {
                        let newStart = dragState.initialStart + timeDelta;
                        newStart = Math.max(0, newStart);
                        return { ...z, startTime: newStart };
                    } else {
                        let newDuration = dragState.initialDuration + timeDelta;
                        newDuration = Math.max(0.5, newDuration);
                        return { ...z, duration: newDuration };
                    }
                }));
             } else if (dragState.type === 'clip') {
                 setClips(prev => prev.map(c => {
                    if (c.id !== dragState.id) return c;
                    
                    if (dragState.mode === 'move') {
                        let newStart = dragState.initialStart + timeDelta;
                        newStart = Math.max(0, newStart);
                        return { ...c, startTime: newStart };
                    } else {
                        let newDuration = dragState.initialDuration + timeDelta;
                        newDuration = Math.max(0.5, newDuration);
                        return { ...c, duration: newDuration };
                    }
                 }));
             }
        };

        const handleMouseUp = () => {
            if (dragState.type === 'playhead') {
                setDragState(null);
            }
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }
  }, [dragState, timelineDuration, timelineScale]);

  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if ((e.target as HTMLElement).tagName === 'INPUT') return;
          if ((e.target as HTMLElement).tagName === 'TEXTAREA') return;
          
          let keyDisplay = e.key;
          if (e.code === 'Space') keyDisplay = '␣ Space';
          if (e.metaKey) keyDisplay = '⌘ ' + keyDisplay.toUpperCase();
          if (e.ctrlKey) keyDisplay = '⌃ ' + keyDisplay.toUpperCase();
          if (e.shiftKey && keyDisplay.length === 1) keyDisplay = '⇧ ' + keyDisplay.toUpperCase();
          
          if (keyDisplay.length === 1) keyDisplay = keyDisplay.toUpperCase();

          setActiveKey(keyDisplay);

          if (keyTimeoutRef.current) {
              window.clearTimeout(keyTimeoutRef.current);
          }
          keyTimeoutRef.current = window.setTimeout(() => {
              setActiveKey(null);
          }, 1500);
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => {
          window.removeEventListener('keydown', handleKeyDown);
          if (keyTimeoutRef.current) window.clearTimeout(keyTimeoutRef.current);
      };
  }, []);


  const togglePlay = useCallback(() => setIsPlaying(p => !p), []);

  const handleScrubStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    if (!timelineRef.current) return;

    if (dragState && dragState.type !== 'playhead') {
        setDragState(null);
        return;
    }
    
    const rect = timelineRef.current.getBoundingClientRect();
    const trackWidth = timelineDuration * timelineScale;
    const relativeX = e.clientX - rect.left + timelineRef.current.scrollLeft - 16;
    const clampedX = Math.max(0, Math.min(trackWidth, relativeX));
    
    setCurrentTime(clampedX / timelineScale);
    setSelectedZoomId(null);
    setSelectedClipId(null);
    
    setDragState({ type: 'playhead' });
  }, [dragState, timelineDuration, timelineScale]);

  const addZoom = useCallback(() => {
    const newZoom: ZoomEvent = {
        id: crypto.randomUUID(),
        startTime: currentTime,
        duration: 3,
        x: 50,
        y: 50,
        scale: 1.5
    };
    setZooms(prev => [...prev, newZoom]);
    setSelectedZoomId(newZoom.id);
  }, [currentTime]);

  const clearZooms = useCallback(() => {
      setZooms([]); 
      setSelectedZoomId(null);
  }, []);

  const removeZoom = useCallback((id: string) => {
      setZooms(prev => prev.filter(z => z.id !== id));
      if (selectedZoomId === id) {
        setSelectedZoomId(null);
      }
  }, [selectedZoomId]);

  const updateZoom = useCallback((id: string, updates: Partial<ZoomEvent>) => {
    setZooms(prev => prev.map(z => z.id === id ? { ...z, ...updates } : z));
  }, []);

  const autoGenerateZooms = useCallback(async () => {
      const activeVideoClip = clips.find(c => c.type === 'video' && c.source);
      
      if (!activeVideoClip || !activeVideoClip.source) {
          const generated: ZoomEvent[] = [];
          const count = 3;
          for (let i = 0; i < count; i++) {
              generated.push({
                  id: crypto.randomUUID(),
                  startTime: (i + 1) * (timelineDuration / (count + 1)),
                  duration: 2.5,
                  x: 20 + Math.random() * 60,
                  y: 20 + Math.random() * 60,
                  scale: 1.5
              });
          }
          setZooms(generated);
          setSelectedZoomId(null);
          return;
      }

      setIsAnalyzingZooms(true);

      if ((window as any).aistudio) {
        const hasKey = await (window as any).aistudio.hasSelectedApiKey();
        if (!hasKey) {
            await (window as any).aistudio.openSelectKey();
        }
      }

      const generatedZooms = await analyzeVideoForZooms(activeVideoClip.source, activeVideoClip.duration);
      
      if (generatedZooms.length > 0) {
          const adjustedZooms = generatedZooms.map(z => ({
              ...z,
              startTime: z.startTime + activeVideoClip.startTime
          }));
          setZooms(adjustedZooms);
      } else {
          alert("AI could not identify significant events. Try recording a clearer sequence.");
      }
      
      setIsAnalyzingZooms(false);
      setSelectedZoomId(null);
  }, [clips, timelineDuration]);

  const handleCanvasDoubleClick = useCallback((xPercent: number, yPercent: number) => {
      const newZoom: ZoomEvent = {
          id: crypto.randomUUID(),
          startTime: currentTime,
          duration: 2.0,
          x: xPercent,
          y: yPercent,
          scale: 1.5
      };
      setZooms(prev => [...prev, newZoom]);
      setSelectedZoomId(newZoom.id);
  }, [currentTime]);


  const handleSplit = useCallback(() => {
    const clipToSplit = clips.find(c => currentTime > c.startTime && currentTime < (c.startTime + c.duration));
    if (!clipToSplit) return;

    const firstDuration = currentTime - clipToSplit.startTime;
    const secondDuration = clipToSplit.duration - firstDuration;

    if (firstDuration < 0.1 || secondDuration < 0.1) return;

    const clipA: VideoClip = { ...clipToSplit, duration: firstDuration };
    const clipB: VideoClip = { 
        id: crypto.randomUUID(), 
        startTime: currentTime, 
        duration: secondDuration, 
        name: clipToSplit.name,
        type: clipToSplit.type,
        text: clipToSplit.text,
        titleStyle: clipToSplit.titleStyle,
        source: clipToSplit.source,
        width: clipToSplit.width,
        height: clipToSplit.height
    };

    setClips(prev => {
        const idx = prev.findIndex(c => c.id === clipToSplit.id);
        const newClips = [...prev];
        newClips.splice(idx, 1, clipA, clipB);
        return newClips;
    });
  }, [clips, currentTime]);

  const handleDeleteClip = useCallback(() => {
      if (selectedClipId) {
          setClips(prev => prev.filter(c => c.id !== selectedClipId));
          setSelectedClipId(null);
      }
  }, [selectedClipId]);

  const handleAddTitleClip = useCallback((text: string, style: TitleStyle) => {
      const activeVideoClip = clips
        .slice()
        .reverse()
        .find(c => c.type === 'video' && currentTime >= c.startTime && currentTime < (c.startTime + c.duration));

      const newClip: VideoClip = {
          id: crypto.randomUUID(),
          startTime: currentTime,
          duration: 3.0,
          name: 'Title Card',
          type: 'title',
          text: text,
          titleStyle: style,
          width: activeVideoClip?.width,
          height: activeVideoClip?.height
      };
      setClips(prev => [...prev, newClip]);
      setSelectedClipId(newClip.id);
  }, [clips, currentTime]);

  const startRecording = async () => {
    try {
      let stream: MediaStream;

      // Check if running in Electron with desktopCapturer available
      if (isElectron && electronAPI?.getDesktopSources) {
        // Use Electron's desktopCapturer
        const sources = await electronAPI.getDesktopSources(['screen', 'window']);
        
        if (!sources || sources.length === 0) {
          throw new Error('No screen sources available. Please grant screen recording permission in System Preferences > Privacy & Security > Screen Recording.');
        }

        // Use the first screen source (primary display)
        const screenSource = sources.find((s: any) => s.id.startsWith('screen:')) || sources[0];
        
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            // @ts-ignore - Electron-specific constraint
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: screenSource.id,
              minWidth: 1280,
              maxWidth: 3840,
              minHeight: 720,
              maxHeight: 2160
            }
          }
        });
      } else {
        // Fallback to standard web API (works in browsers)
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: { 
              // @ts-ignore
              cursor: "always"
          } as any,
          audio: false
        });
      }
      
      await new Promise(r => setTimeout(r, 200));

      const track = stream.getVideoTracks()[0];
      const settings = track.getSettings();
      const streamWidth = settings.width || window.screen.width; 
      
      const isFullScreen = 
         streamWidth >= window.screen.width - 50 || 
         streamWidth >= (window.screen.width * 2) - 100;

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
  
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      const handleStop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        
        stream.getTracks().forEach(track => track.stop());
        setIsRecording(false);

        // Get video metadata first
        const videoEl = document.createElement('video');
        videoEl.preload = 'auto';
        
        const getMetadata = (): Promise<{duration: number, width: number, height: number}> => {
          return new Promise((resolve) => {
            videoEl.onloadedmetadata = () => {
              resolve({
                duration: Number.isFinite(videoEl.duration) ? videoEl.duration : 10,
                width: videoEl.videoWidth || 1920,
                height: videoEl.videoHeight || 1080
              });
            };
            videoEl.onerror = () => resolve({ duration: 10, width: 1920, height: 1080 });
            videoEl.src = URL.createObjectURL(blob);
          });
        };

        const { duration, width, height } = await getMetadata();
        const rawUrl = URL.createObjectURL(blob);

        // Create clip from recorded video
        const newClip: VideoClip = {
          id: crypto.randomUUID(),
          startTime: 0,
          duration: duration,
          name: 'Screen Recording',
          type: 'video',
          source: rawUrl,
          width: width,
          height: height
        };
        setClips(prev => {
          const filtered = prev.filter(c => c.name !== 'Demo Project');
          return [...filtered, newClip];
        });
        setSelectedClipId(newClip.id);
        setCurrentTime(0);
      };
  
      recorder.onstop = handleStop;
      
      stream.getVideoTracks()[0].onended = () => {
          if (recorder.state !== 'inactive') {
              recorder.stop();
          }
      };
  
      recorder.start();
      setIsRecording(true);
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
          return;
      }
      console.error("Error starting recording:", err);
      alert("Failed to start recording: " + err.message);
    }
  };
  
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const pickRecorderMimeType = useCallback(() => {
      const candidates = [
          'video/webm;codecs=vp9',
          'video/webm;codecs=vp8',
          'video/webm'
      ];
      for (const t of candidates) {
          if (MediaRecorder.isTypeSupported(t)) return t;
      }
      return '';
  }, []);

  const captureEditedTimeline = useCallback(async (opts: { frameRate: number; bitrate: number }) => {
      // Reset cursor data for this capture
      exportCursorDataRef.current = [];

      let stopMouseListener: (() => void) | null = null;
      let stopMouseTracking: (() => void) | null = null;
      let bounds: { x: number; y: number; width: number; height: number } | null = null;
      const captureStart = performance.now();

      if (isElectron && electronAPI?.startMouseTracking && electronAPI?.onMousePosition && electronAPI?.getWindowBounds) {
          try {
              bounds = await electronAPI.getWindowBounds();
              await electronAPI.startMouseTracking();
              stopMouseTracking = () => { void electronAPI.stopMouseTracking?.(); };
              stopMouseListener = electronAPI.onMousePosition((data) => {
                  if (!bounds) return;
                  const t = (performance.now() - captureStart) / 1000;
                  const nx = (data.x - bounds.x) / bounds.width;
                  const ny = (data.y - bounds.y) / bounds.height;
                  if (!Number.isFinite(nx) || !Number.isFinite(ny)) return;
                  // clamp
                  const x = Math.max(0, Math.min(1, nx));
                  const y = Math.max(0, Math.min(1, ny));
                  exportCursorDataRef.current.push({ x, y, time: t });
              });
          } catch {
              // no-op
          }
      }

      if (isElectron && electronAPI?.closeDevTools) {
          try { await electronAPI.closeDevTools(); } catch {}
      }

      const mimeType = pickRecorderMimeType();

      // Ensure UI has time to switch into clean export mode
      await new Promise(r => setTimeout(r, 200));

      let stream: MediaStream;
      if (isElectron && electronAPI?.getDesktopSources) {
          const sources = await electronAPI.getDesktopSources(['window']);
          if (!sources || sources.length === 0) {
              throw new Error('No window sources available.');
          }

          const preferred =
              sources.find((s: any) => typeof s.name === 'string' && s.name.includes('Cursor Flow Tech Demo')) ||
              sources.find((s: any) => typeof s.name === 'string' && s.name.includes('Cursor Flow')) ||
              sources.find((s: any) => typeof s.name === 'string' && s.name.includes('localhost')) ||
              sources[0];

          stream = await navigator.mediaDevices.getUserMedia({
              audio: false,
              video: {
                  // @ts-ignore
                  mandatory: {
                      chromeMediaSource: 'desktop',
                      chromeMediaSourceId: preferred.id,
                      maxFrameRate: opts.frameRate
                  }
              }
          });
      } else {
          // Dev fallback
          stream = await navigator.mediaDevices.getDisplayMedia({
              video: { 
                  // @ts-ignore
                  frameRate: opts.frameRate
              } as any,
              audio: false
          });
      }

      const recorder = mimeType
          ? new MediaRecorder(stream, { mimeType, videoBitsPerSecond: opts.bitrate })
          : new MediaRecorder(stream, { videoBitsPerSecond: opts.bitrate });
      const chunks: Blob[] = [];
      exportRecorderRef.current = recorder;

      return await new Promise<Blob>((resolve, reject) => {
          recorder.ondataavailable = (e) => {
              if (e.data.size > 0) chunks.push(e.data);
          };

          recorder.onerror = (e: any) => {
              try { stream.getTracks().forEach(t => t.stop()); } catch {}
              exportRecorderRef.current = null;
              try { stopMouseListener?.(); } catch {}
              try { stopMouseTracking?.(); } catch {}
              reject(new Error(e?.error?.message || 'Export recorder error'));
          };

          recorder.onstop = () => {
              try { stream.getTracks().forEach(t => t.stop()); } catch {}
              exportRecorderRef.current = null;
              try { stopMouseListener?.(); } catch {}
              try { stopMouseTracking?.(); } catch {}
              if (chunks.length === 0) {
                  reject(new Error('No frames captured'));
                  return;
              }
              resolve(new Blob(chunks, { type: mimeType || chunks[0].type || 'video/webm' }));
          };

          const videoTrack = stream.getVideoTracks()[0];
          if (videoTrack) {
              videoTrack.onended = () => {
                  if (recorder.state !== 'inactive') recorder.stop();
              };
          }

          recorder.start(1000);
      });
  }, [electronAPI, isElectron, pickRecorderMimeType]);

  const handleExport = async (format: 'mp4' | 'gif', quality: 'high' | 'balanced') => {
      // Desktop-first: if backend is available, use backend export for MP4 (captures the edited timeline first)
      if (backendAvailable && format === 'mp4') {
          setShowExportMenu(false);
          setExportOptions(prev => ({ ...prev, quality }));
          setShowExportModal(true);
          return;
      }

      // Fallback to recorder-based export (WEBM)
      try {
          // Force Clean Mode
          setIsExporting(true);
          setShowExportMenu(false);
          setShowExportModal(false);
          setIsCaptureMode(true);

          const frameRate = format === 'gif' ? 15 : (quality === 'high' ? 60 : 30);
          let bitrate = 8000000;
          if (quality === 'high') bitrate = 12000000;
          if (format === 'gif') bitrate = 1500000;

          setCurrentTime(0);
          const blobPromise = captureEditedTimeline({ frameRate, bitrate });

          // Give recorder a moment to start before running playback
          await new Promise(r => setTimeout(r, 250));
          setIsPlaying(true);

          const blob = await blobPromise;

          // Ensure playback stops
          setIsPlaying(false);
          setCurrentTime(0);
          setIsCaptureMode(false);

          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;

          const now = new Date();
          const timestamp = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
          const suffix = format === 'gif' ? '-gif-ready' : '';
          a.download = `cursor-flow-timeline-${timestamp}${suffix}.webm`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          setIsExporting(false);

      } catch (err: any) {
          if (err.name === 'NotAllowedError') {
              setIsExporting(false);
              return;
          }
          console.error("Export failed:", err);
          setIsCaptureMode(false);
          setIsExporting(false);
          alert("Export failed: " + err.message);
      }
  };

  const handleBackendExport = async () => {
      setIsExporting(true);
      setExportProgress(0);
      setExportStatus('Recording timeline...');
      setIsCaptureMode(true);
      setShowExportModal(false);

      try {
          const frameRate = exportOptions.quality === 'high' ? 60 : 30;
          const bitrate = exportOptions.quality === 'high' ? 12000000 : 8000000;

          setCurrentTime(0);
          const capturePromise = captureEditedTimeline({ frameRate, bitrate });
          setIsPlaying(true);
          const videoBlob = await capturePromise;
          setIsPlaying(false);
          setCurrentTime(0);
          setIsCaptureMode(false);
          setShowExportModal(true);

          setExportStatus('Uploading timeline...');

          // Process with backend (no cursor data)
          const resultBlob = await processVideoWithProgress(
              videoBlob,
              exportCursorDataRef.current,
              exportOptions,
              (progress, status) => {
                  setExportProgress(progress);
                  setExportStatus(status);
              }
          );

          // Download result
          const url = URL.createObjectURL(resultBlob);
          const a = document.createElement('a');
          a.href = url;
          const now = new Date();
          const timestamp = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
          a.download = `cursor-flow-${timestamp}.mp4`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          setShowExportModal(false);
      } catch (err: any) {
          console.error('Backend export failed:', err);
          alert(`Export failed: ${err.message}`);
      } finally {
          setIsCaptureMode(false);
          setIsExporting(false);
          setExportProgress(0);
          setExportStatus('');
      }
  };

  const saveProject = useCallback(async () => {
    try {
      const safeClips = clips.map(c => {
         if (c.source && c.source.startsWith('blob:')) {
            return { ...c, source: undefined };
         }
         return c;
      });

      const project: ProjectState = {
        version: 1,
        config,
        currentPreset,
        blurEnabled,
        background,
        backgroundBlur,
        showCamera,
        contentScale,
        borderRadius,
        aspectRatio,
        showWindowFrame,
        showKeystrokes,
        zooms,
        clips: safeClips
      };

      const projectJson = JSON.stringify(project, null, 2);

      if (isElectron && electronAPI?.saveProjectFile) {
        const result = await electronAPI.saveProjectFile({
          data: projectJson,
          defaultPath: 'cursor-flow-project.cursorflow.json',
          filePath: projectFilePath
        });
        if (result?.canceled) return;
        if (result?.filePath) {
          setProjectFilePath(result.filePath);
          try {
            localStorage.setItem(PROJECT_FILE_PATH_KEY, result.filePath);
          } catch {}
        }
        alert('Project Saved!');
        return;
      }

      localStorage.setItem(STORAGE_KEY, projectJson);
      alert("Project Saved! (Note: Recorded videos are temporary and won't reload)");
    } catch (e) {
      console.error("Failed to save project", e);
      alert("Failed to save project. Storage might be full.");
    }
  }, [clips, config, currentPreset, blurEnabled, background, backgroundBlur, showCamera, contentScale, borderRadius, aspectRatio, showWindowFrame, showKeystrokes, zooms, isElectron, electronAPI, projectFilePath]);

  const revealProjectInFolder = useCallback(async () => {
    if (!isElectron || !electronAPI?.revealItemInFolder) {
      alert('Not available outside Electron.');
      return;
    }
    if (!projectFilePath) {
      alert('Save the project first.');
      return;
    }
    await electronAPI.revealItemInFolder(projectFilePath);
  }, [isElectron, electronAPI, projectFilePath]);

  const loadProject = useCallback(() => {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) {
        alert("No saved project found.");
        return;
      }
      const project = JSON.parse(data) as ProjectState;
      
      setConfig(project.config);
      setCurrentPreset(project.currentPreset);
      setBlurEnabled(project.blurEnabled);
      setBackground(project.background);
      setBackgroundBlur(project.backgroundBlur || 0);
      setShowCamera(project.showCamera);
      setContentScale(project.contentScale);
      setBorderRadius(project.borderRadius || 20);
      setAspectRatio(project.aspectRatio);
      setShowWindowFrame(project.showWindowFrame);
      setShowKeystrokes(project.showKeystrokes);
      setZooms(project.zooms);
      setClips(project.clips);
      
      setCurrentTime(0);
      setIsPlaying(false);
      
    } catch (e) {
      console.error("Failed to load project", e);
      alert("Failed to load project data.");
    }
  }, []);

  const onClipInteraction = useCallback((e: React.PointerEvent, id: string, mode: 'move' | 'resize', start: number, dur: number) => {
    e.stopPropagation();
    e.preventDefault();
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const contentX = e.clientX - rect.left + timelineRef.current.scrollLeft - 16;
    setSelectedClipId(id);
    setSelectedZoomId(null);
    setDragState(prev => {
        if (prev && prev.type === 'clip' && prev.id === id && prev.mode === mode) {
            return null;
        }
        return {
            type: 'clip',
            id,
            mode,
            startX: contentX,
            initialStart: start,
            initialDuration: dur
        };
    });
  }, [timelineScale, timelineDuration]);

  const onZoomInteraction = useCallback((e: React.PointerEvent, id: string, mode: 'move' | 'resize', start: number, dur: number) => {
    e.stopPropagation();
    e.preventDefault();
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const contentX = e.clientX - rect.left + timelineRef.current.scrollLeft - 16;
    setSelectedZoomId(id);
    setSelectedClipId(null);
    setDragState(prev => {
        if (prev && prev.type === 'zoom' && prev.id === id && prev.mode === mode) {
            return null;
        }
        return {
            type: 'zoom',
            id,
            mode,
            startX: contentX,
            initialStart: start,
            initialDuration: dur
        };
    });
  }, [timelineScale, timelineDuration]);

  useEffect(() => {
      if (!isPlaying) return;
      if (!timelineRef.current) return;
      const viewW = timelineRef.current.clientWidth;
      const x = 16 + currentTime * timelineScale;
      const left = timelineRef.current.scrollLeft;
      const right = left + viewW;
      const margin = 120;
      if (x < left + margin) {
          timelineRef.current.scrollLeft = Math.max(0, x - margin);
      } else if (x > right - margin) {
          timelineRef.current.scrollLeft = Math.max(0, x - (viewW - margin));
      }
  }, [currentTime, isPlaying, timelineScale]);

  const activeClip = clips
    .slice() 
    .reverse() 
    .find(c => currentTime >= c.startTime && currentTime < (c.startTime + c.duration));
    
  const isVideoActive = !!activeClip;

  return (
    <div className="h-screen w-screen flex flex-col bg-zinc-950 text-zinc-200">
      {!isExporting && !isCaptureMode && (
      <header className="h-14 border-b border-zinc-800 flex items-center px-4 justify-between bg-zinc-900/50 backdrop-blur-md z-10 relative">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Video className="text-white w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white">Cursor Flow</h1>
            <p className="text-[10px] text-zinc-500 font-mono">RECORDING REIMAGINED.</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
           <div className="flex items-center gap-1 mr-2 border-r border-zinc-700 pr-4">
              <button onClick={saveProject} className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors" title="Save Project">
                <Save className="w-4 h-4" />
              </button>
              <button onClick={revealProjectInFolder} className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors" title="Show in Folder">
                <FolderOpen className="w-4 h-4" />
              </button>
           </div>

           <button 
              onClick={isRecording ? stopRecording : startRecording}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-2 ${isRecording ? 'bg-rose-600 text-white animate-pulse' : 'bg-rose-600 text-white hover:bg-rose-700'}`}
           >
              {isRecording ? <Square className="w-3 h-3 fill-current" /> : <Circle className="w-3 h-3 fill-current" />}
              {isRecording ? 'Stop Recording' : 'Record'}
           </button>

           <div className="text-xs text-zinc-500 flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
              {isPlaying ? 'Playing' : 'Ready'}
           </div>
           
           <div className="text-xs text-zinc-500 flex items-center gap-2 border-l border-zinc-700 pl-4">
              <span className={`w-2 h-2 rounded-full ${backendAvailable ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
              {backendAvailable ? 'Backend' : 'No Backend'}
           </div>
           
           <div className="relative">
               <button 
                 onClick={() => setShowExportMenu(!showExportMenu)}
                 disabled={isExporting}
                 className={`bg-white text-black px-4 py-1.5 rounded-md text-xs font-semibold hover:bg-zinc-200 transition-colors flex items-center gap-2 ${isExporting ? 'opacity-80 cursor-wait' : ''}`}
               >
                 {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                 {isExporting ? 'Exporting...' : 'Export'}
                 <ChevronDown className="w-3 h-3 ml-1" />
               </button>
               
               {showExportMenu && !isExporting && (
                   <div className="absolute right-0 top-full mt-2 w-48 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl py-1 z-50 animate-in fade-in zoom-in-95">
                       <button onClick={() => handleExport('mp4', 'balanced')} className="w-full text-left px-4 py-2 text-xs hover:bg-zinc-800 text-zinc-300 hover:text-white flex flex-col">
                           <span className="font-semibold">MP4 Balanced</span>
                           <span className="text-[10px] text-zinc-500">30 FPS • Quick Share</span>
                       </button>
                       <button onClick={() => handleExport('mp4', 'high')} className="w-full text-left px-4 py-2 text-xs hover:bg-zinc-800 text-zinc-300 hover:text-white flex flex-col">
                           <span className="font-semibold text-indigo-400">MP4 High Quality</span>
                           <span className="text-[10px] text-zinc-500">60 FPS • Pro</span>
                       </button>
                       <div className="h-px bg-zinc-800 my-1"></div>
                       <button onClick={() => handleExport('gif', 'balanced')} className="w-full text-left px-4 py-2 text-xs hover:bg-zinc-800 text-zinc-300 hover:text-white flex flex-col">
                           <span className="font-semibold">GIF-ready Video</span>
                           <span className="text-[10px] text-zinc-500">15 FPS • Loop • No Audio</span>
                       </button>
                   </div>
               )}
           </div>
        </div>
      </header>
      )}

      <div className="flex-1 flex overflow-hidden">
        <EditorCanvas 
            config={config} 
            blurEnabled={blurEnabled} 
            zoomEnabled={true}
            background={background}
            backgroundBlur={backgroundBlur}
            showCamera={showCamera}
            zooms={zooms}
            currentTime={currentTime}
            isPlaying={isPlaying}
            onCanvasDoubleClick={handleCanvasDoubleClick}
            aspectRatio={aspectRatio}
            showWindowFrame={showWindowFrame}
            showKeystrokes={showKeystrokes}
            activeKey={activeKey}
            isVideoActive={isVideoActive}
            activeClip={activeClip}
            contentScale={contentScale}
            borderRadius={borderRadius}
        />

        {!isExporting && !isCaptureMode && (
        <PhysicsControls 
          config={config}
          onChange={setConfig}
          currentPreset={currentPreset}
          onPresetChange={setCurrentPreset}
          blurEnabled={blurEnabled}
          setBlurEnabled={setBlurEnabled}
          background={background}
          setBackground={setBackground}
          backgroundBlur={backgroundBlur}
          setBackgroundBlur={setBackgroundBlur}
          showCamera={showCamera}
          setShowCamera={setShowCamera}
          onAddZoom={addZoom}
          onClearZooms={clearZooms}
          onAutoGenerateZooms={autoGenerateZooms}
          zoomCount={zooms.length}
          timelineDuration={timelineDuration}
          aspectRatio={aspectRatio}
          setAspectRatio={setAspectRatio}
          showWindowFrame={showWindowFrame}
          setShowWindowFrame={setShowWindowFrame}
          showKeystrokes={showKeystrokes}
          setShowKeystrokes={setShowKeystrokes}
          zooms={zooms}
          selectedZoomId={selectedZoomId}
          onSelectZoom={setSelectedZoomId}
          onUpdateZoom={updateZoom}
          onDeleteZoom={removeZoom}
          onAddTitleClip={handleAddTitleClip}
          contentScale={contentScale}
          setContentScale={setContentScale}
          borderRadius={borderRadius}
          setBorderRadius={setBorderRadius}
          isAnalyzingZooms={isAnalyzingZooms}
        />
        )}
      </div>
    
    {!isExporting && !isCaptureMode && (
    <div className="h-64 border-t border-zinc-800 bg-zinc-900 flex flex-col select-none">
      <div className="h-10 border-b border-zinc-800 flex items-center px-4 gap-4 bg-zinc-900 justify-between">
           <div className="flex items-center gap-4">
               <button 
                  onClick={togglePlay}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-zinc-800 text-zinc-300 transition-colors"
               >
                  {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
               </button>
               <span className="text-xs font-mono text-zinc-500">
                  {Math.floor(currentTime)}s / {Math.ceil(timelineDuration)}s
               </span>
               <div className="flex items-center gap-2">
                  <span className="text-[10px] text-zinc-600 font-semibold uppercase tracking-wider">Timeline Zoom</span>
                  <input
                    type="range"
                    min={40}
                    max={200}
                    step={5}
                    value={timelineScale}
                    onChange={(e) => setTimelineScale(Number(e.target.value))}
                    className="w-28 accent-indigo-500"
                  />
               </div>
           </div>

         <div className="flex items-center gap-1 border-l border-zinc-800 pl-4">
             <button 
               onClick={handleSplit}
               className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
             >
                <Scissors className="w-3.5 h-3.5" /> Split
             </button>
             <button 
               onClick={handleDeleteClip}
               disabled={!selectedClipId}
               className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded transition-colors ${selectedClipId ? 'text-rose-400 hover:bg-rose-900/20' : 'text-zinc-600'}`}
               title="Delete Selected Clip"
             >
                <Trash2 className="w-3.5 h-3.5" /> Delete
             </button>
         </div>
    </div>

      <div className="flex-1 relative bg-[#111113] overflow-x-auto overflow-y-hidden" ref={timelineRef}>
        <div className="relative h-full" style={{ width: timelineContentWidth }}>
          <TimelineTracks 
             clips={clips}
             zooms={zooms}
             selectedClipId={selectedClipId}
             selectedZoomId={selectedZoomId}
             duration={timelineDuration}
             scale={timelineScale}
             contentWidth={timelineContentWidth}
             onScrubStart={handleScrubStart}
             onClipInteraction={onClipInteraction}
             onZoomInteraction={onZoomInteraction}
          />
          <Playhead 
             currentTime={currentTime} 
             scale={timelineScale}
             onPointerDown={handleScrubStart}
           />
        </div>
      </div>
    </div>
    )}

    {/* Export Modal */}
      {showExportModal && !isCaptureMode && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-[480px] max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
                  <Cpu className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Export with Backend</h2>
                  <p className="text-xs text-zinc-500">High-quality video processing</p>
                </div>
              </div>
              <button 
                onClick={() => setShowExportModal(false)}
                disabled={isExporting}
                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Cursor Style */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Cursor Style</label>
                <div className="grid grid-cols-3 gap-2">
                  {['fancy', 'macos', 'circle', 'dot', 'ring', 'crosshair'].map(style => (
                    <button
                      key={style}
                      onClick={() => setExportOptions(prev => ({ ...prev, cursorStyle: style }))}
                      className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                        exportOptions.cursorStyle === style 
                          ? 'bg-indigo-600 text-white' 
                          : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                      }`}
                    >
                      {style.charAt(0).toUpperCase() + style.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cursor Size */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Cursor Size: {exportOptions.cursorSize}px
                </label>
                <input
                  type="range"
                  min="24"
                  max="96"
                  value={exportOptions.cursorSize}
                  onChange={(e) => setExportOptions(prev => ({ ...prev, cursorSize: parseInt(e.target.value) }))}
                  className="w-full accent-indigo-600"
                />
              </div>

              {/* Quality */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Quality</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'fast', label: 'Fast', desc: 'Quick export' },
                    { id: 'balanced', label: 'Balanced', desc: 'Good quality' },
                    { id: 'high', label: 'High', desc: 'Best quality' },
                  ].map(q => (
                    <button
                      key={q.id}
                      onClick={() => setExportOptions(prev => ({ ...prev, quality: q.id as 'high' | 'balanced' | 'fast' }))}
                      className={`px-3 py-2 rounded-lg text-left transition-colors ${
                        exportOptions.quality === q.id 
                          ? 'bg-indigo-600 text-white' 
                          : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                      }`}
                    >
                      <div className="text-xs font-medium">{q.label}</div>
                      <div className="text-[10px] opacity-70">{q.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Smooth Motion Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-zinc-300">Smooth Motion</div>
                  <div className="text-xs text-zinc-500">Apply motion smoothing to cursor</div>
                </div>
                <button
                  onClick={() => setExportOptions(prev => ({ ...prev, smooth: !prev.smooth }))}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    exportOptions.smooth ? 'bg-indigo-600' : 'bg-zinc-700'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    exportOptions.smooth ? 'translate-x-6' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>

              {/* Progress */}
              {isExporting && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400">{exportStatus}</span>
                    <span className="text-indigo-400 font-mono">{Math.round(exportProgress)}%</span>
                  </div>
                  <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-indigo-600 transition-all duration-300"
                      style={{ width: `${exportProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800 bg-zinc-900/50">
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                Powered by OpenCV + ffmpeg
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowExportModal(false)}
                  disabled={isExporting}
                  className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBackendExport}
                  disabled={isExporting}
                  className="px-6 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Export MP4
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
