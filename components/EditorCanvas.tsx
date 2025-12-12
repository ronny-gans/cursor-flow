
import React, { useRef, useEffect, useState } from 'react';
import { motion, useSpring, useMotionValue, useTransform, AnimatePresence } from 'framer-motion';
import { BackgroundStyle, PhysicsConfig, ZoomEvent, VideoClip, AspectRatio } from '../types';
import { Camera, CameraOff, VideoOff, Type } from 'lucide-react';

interface EditorCanvasProps {
  config: PhysicsConfig;
  blurEnabled: boolean;
  zoomEnabled: boolean;
  background: BackgroundStyle;
  backgroundBlur?: number;
  showCamera: boolean;
  zooms: ZoomEvent[];
  currentTime: number;
  isPlaying: boolean;
  onCanvasDoubleClick: (xPercent: number, yPercent: number) => void;
  aspectRatio: AspectRatio;
  showWindowFrame: boolean;
  showKeystrokes: boolean;
  activeKey: string | null;
  isVideoActive: boolean;
  activeClip?: VideoClip;
  contentScale: number;
  borderRadius?: number;
}

const CameraBubble = () => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [errorText, setErrorText] = useState<string | null>(null);

    useEffect(() => {
        let stream: MediaStream | null = null;
        let cancelled = false;
        const start = async () => {
            try {
                setHasPermission(null);
                setErrorText(null);
                const s = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: 'user',
                        width: { ideal: 640 },
                        height: { ideal: 640 }
                    }
                });
                if (cancelled) {
                    s.getTracks().forEach(t => t.stop());
                    return;
                }
                stream = s;
                if (videoRef.current) {
                    videoRef.current.srcObject = s;
                    try {
                        await videoRef.current.play();
                    } catch {
                        // ignore autoplay issues; user gesture might be required in some environments
                    }
                }
                setHasPermission(true);
            } catch (err: any) {
                setHasPermission(false);
                setErrorText(err?.message || 'Camera unavailable');
            }
        };
        start();

        return () => {
            cancelled = true;
            if (stream) stream.getTracks().forEach(track => track.stop());
        };
    }, []);

    return (
        <motion.div 
            drag
            dragMomentum={false}
            whileHover={{ scale: 1.05 }}
            className="absolute bottom-8 right-8 w-40 h-40 rounded-full overflow-hidden border-4 border-white shadow-2xl z-[60] cursor-grab active:cursor-grabbing bg-black flex items-center justify-center group"
        >
            {hasPermission === null ? (
                 <div className="flex flex-col items-center justify-center text-zinc-500 gap-1">
                     <Camera className="w-6 h-6" />
                     <span className="text-[10px]">Camera...</span>
                 </div>
            ) : hasPermission === false ? (
                 <div className="flex flex-col items-center justify-center text-zinc-500 gap-1">
                     <CameraOff className="w-6 h-6" />
                     <span className="text-[10px]">No Camera</span>
                     {errorText && <span className="text-[10px] text-zinc-600 max-w-[120px] text-center truncate">{errorText}</span>}
                 </div>
            ) : (
                <video ref={videoRef} className="w-full h-full object-cover transform scale-x-[-1]" muted playsInline />
            )}
            
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                <span className="text-white text-xs font-medium">Drag Me</span>
            </div>
        </motion.div>
    );
}

export const EditorCanvas: React.FC<EditorCanvasProps> = React.memo(({ 
    config, blurEnabled, zoomEnabled, background, backgroundBlur = 0, showCamera, zooms, currentTime, isPlaying, onCanvasDoubleClick,
    aspectRatio, showWindowFrame, showKeystrokes, activeKey, isVideoActive, activeClip, contentScale, borderRadius = 20
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const targetCamX = useMotionValue(0);
  const targetCamY = useMotionValue(0);
  const targetScaleMV = useMotionValue(1);

  const activeZoom = zooms.find(z => currentTime >= z.startTime && currentTime <= (z.startTime + z.duration));

  // --- UNIFIED PHYSICS CONFIG ---
  // We use this single config for X, Y, and Scale during zooms to ensure they lock-step perfectly.
  const zoomPhysics = {
      stiffness: 60,
      damping: 20,
      mass: 1.5,
      restDelta: 0.001
  };

  const activePhysics = activeZoom ? zoomPhysics : config;

  // --- SPRINGS ---
  // Camera springs (drive the video container)
  // CRITICAL: All 3 (X, Y, Scale) must use the SAME physics to avoid wobble (straight line interpolation)
  const camX = useSpring(targetCamX, activePhysics);
  const camY = useSpring(targetCamY, activePhysics);
  const springScale = useSpring(targetScaleMV, activePhysics);


  const getContainerDimensions = (ratio: AspectRatio) => {
      if (ratio === 'Auto') {
          if (!activeClip) return { width: 800, height: 450 }; // Default fallback
          
          const headerH = showWindowFrame ? 32 : 0;
          const clipW = activeClip.width || 1920;
          const clipH = activeClip.height || 1080;
          
          // Calculate Aspect Ratio of Content (Height / Width)
          const contentRatio = (clipH + headerH) / clipW;

          // Target Base Width
          const targetW = 800;
          
          // Apply formula for Equal Margins:
          // H = W * ( s * R + (1 - s) )
          // s = effective scale (clamped to 1)
          // R = content ratio
          const effectiveScale = Math.min(contentScale, 1);
          const targetH = targetW * (effectiveScale * contentRatio + (1 - effectiveScale));
          
          return { width: targetW, height: targetH };
      }

      switch (ratio) {
          case '16:9': return { width: 800, height: 450 };
          case '9:16': return { width: 360, height: 640 };
          case '1:1': return { width: 500, height: 500 };
          case '4:3': return { width: 640, height: 480 };
          case '21:9': return { width: 800, height: 340 };
          default: return { width: 800, height: 450 };
      }
  };

  const { width: containerWidth, height: containerHeight } = getContainerDimensions(aspectRatio);

  const panX = useTransform(camX, (x) => aspectRatio === '9:16' ? 0 : 0); // Placeholder if we need inner-pan
  const panY = useTransform(camY, (y) => aspectRatio === '9:16' ? 0 : 0);

  const filterId = "motionBlurFilter";
  const blurAmount = 8;


  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const offsetY = e.clientY - rect.top;
      const xPercent = (offsetX / rect.width) * 100;
      const yPercent = (offsetY / rect.height) * 100;
      onCanvasDoubleClick(xPercent, yPercent);
  };
  
  // Calculate fitted dimensions for the window frame
  const getFittedDimensions = () => {
      if (!activeClip) return { width: containerWidth, height: containerHeight, contentHeight: containerHeight };
      
      const headerH = showWindowFrame ? 32 : 0;
      const clipW = activeClip.width || 1920;
      const clipH = activeClip.height || 1080;
      const clipRatio = clipW / clipH;

      // Fit Contain Logic
      // 1. Try fitting by Width
      let w = containerWidth;
      let contentH = w / clipRatio;
      let h = contentH + headerH;

      // 2. If Height overflows Container Height, fit by Height
      if (h > containerHeight + 0.5) {
          h = containerHeight;
          contentH = h - headerH;
          w = contentH * clipRatio;
      }

      return { width: w, height: h, contentHeight: contentH };
  };

  const { width: windowW, height: windowH, contentHeight: windowContentH } = getFittedDimensions();

  
  // --- SCALE & ZOOM EVENTS ---
  useEffect(() => {
     const scale = activeZoom ? activeZoom.scale : contentScale;
     targetScaleMV.set(scale);
  }, [activeZoom, contentScale, targetScaleMV]);

  // --- ZOOM EVENT CAMERA TARGETING ---
  // When a zoom becomes active, we calculate the EXACT target camera position
  // and set it. The spring handles the smooth, straight transition.
  useEffect(() => {
      if (activeZoom) {
          // Calculate Target Focus Point (relative to center)
          const focusPxX = ((activeZoom.x - 50) / 100) * containerWidth;
          const focusPxY = ((activeZoom.y - 50) / 100) * containerHeight;

          // Calculate Target Scale
          const s = activeZoom.scale;

          // Calculate Target Camera Translation (Ideal)
          const idealCamX = -focusPxX * s;
          const idealCamY = -focusPxY * s;

          // Clamping Limits at Target Scale
          const maxOffsetX = (containerWidth / 2) * (s - 1);
          const maxOffsetY = (containerHeight / 2) * (s - 1);

          // Final Clamped Target
          const tx = Math.max(-maxOffsetX, Math.min(maxOffsetX, idealCamX));
          const ty = Math.max(-maxOffsetY, Math.min(maxOffsetY, idealCamY));

          targetCamX.set(tx);
          targetCamY.set(ty);
      } else {
          targetCamX.set(0);
          targetCamY.set(0);
      }
  }, [activeZoom, containerWidth, containerHeight, targetCamX, targetCamY]);

  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
      if (!videoRef.current || !activeClip?.source) return;
      const video = videoRef.current;
      const clipTime = Math.max(0, currentTime - activeClip.startTime);
      
      if (!isPlaying) {
          video.currentTime = clipTime;
      } else {
          const drift = Math.abs(video.currentTime - clipTime);
          if (drift > 0.5) video.currentTime = clipTime;
      }

      if (isPlaying && video.paused) video.play().catch(() => {});
      else if (!isPlaying && !video.paused) video.pause();
      
  }, [currentTime, isPlaying, activeClip?.source, activeClip?.startTime]);

  const getBackgroundStyle = () => {
      const gradientMap: Record<string, string> = {
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
      
      const bg = gradientMap[background] || gradientMap.grid;
      return { background: bg };
  };


  return (
    <div className="flex-1 flex items-center justify-center relative overflow-hidden transition-all duration-500 bg-zinc-950">
      {/* Canvas Frame (defines the output aspect ratio) */}
      <div 
        className="relative overflow-hidden bg-zinc-950 shadow-2xl transition-all duration-500"
        style={{ 
            width: containerWidth, 
            height: containerHeight,
            background: backgroundBlur > 0 ? 'transparent' : getBackgroundStyle().background 
        }}
      >
        {background === 'grid' && (
            <div className="absolute inset-0 opacity-20 pointer-events-none" 
                style={{ backgroundImage: 'radial-gradient(#3f3f46 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
            </div>
        )}
        
        {backgroundBlur > 0 && (
             <div className="absolute inset-0" style={{ ...getBackgroundStyle(), filter: `blur(${backgroundBlur}px)` }}></div>
        )}

        <svg className="absolute w-0 h-0">
            <defs>
            <filter id={filterId}>
                <motion.feGaussianBlur 
                    in="SourceGraphic" 
                    // @ts-ignore
                    stdDeviation={blurEnabled ? blurAmount : 0} 
                />
            </filter>
            </defs>
        </svg>

        <AnimatePresence>
            {isVideoActive && activeClip ? (
            <motion.div 
                key="content"
                ref={containerRef}
                onDoubleClick={activeClip.type === 'video' ? handleDoubleClick : undefined}
                style={{ 
                    width: containerWidth, 
                    height: containerHeight,
                    scale: springScale,
                    x: camX, // Driven by unified spring
                    y: camY,
                    transformOrigin: "50% 50%" 
                }}
                className={`absolute inset-0 flex items-center justify-center`}
            >
                {/* Inner Window - Fitted to maximize size while preserving aspect ratio */}
                <motion.div
                    initial={false}
                    className={`relative transition-all overflow-hidden bg-zinc-900 ${
                        showWindowFrame ? 'shadow-[0_30px_60px_-12px_rgba(0,0,0,0.5)]' : 'shadow-none'
                    }`}
                    style={{
                        width: windowW,
                        height: windowH,
                        borderRadius: `${borderRadius}px`
                    }}
                >
                     {/* Window Header */}
                     {showWindowFrame && (
                        <div className="h-8 bg-[#2d2d30] w-full flex items-center px-4 gap-2 border-b border-black/20 z-20 relative shrink-0">
                            <div className="w-3 h-3 rounded-full bg-[#ff5f57] border border-[#e0443e]"></div>
                            <div className="w-3 h-3 rounded-full bg-[#febc2e] border border-[#d89e24]"></div>
                            <div className="w-3 h-3 rounded-full bg-[#28c840] border border-[#1aab29]"></div>
                            <div className="mx-auto text-[10px] font-medium text-zinc-400">Cursor Flow - {activeClip.name}</div>
                        </div>
                    )}

                    {/* Content */}
                    <div className="relative w-full h-full bg-zinc-900 overflow-hidden">
                        <motion.div 
                            className="absolute inset-0 bg-zinc-900"
                            style={{ x: panX, y: panY }}
                        >
                            {activeClip.type === 'title' ? (
                                <div
                                    className="absolute inset-0"
                                    style={{ background: activeClip.titleStyle?.background || 'linear-gradient(135deg, #0f172a 0%, #111827 100%)' }}
                                >
                                    <div
                                        className="absolute w-full"
                                        style={{
                                            left: `${activeClip.titleStyle?.posX ?? 50}%`,
                                            top: `${activeClip.titleStyle?.posY ?? 50}%`,
                                            transform: 'translate(-50%, -50%)',
                                            paddingLeft: 48,
                                            paddingRight: 48,
                                            textAlign: (activeClip.titleStyle?.textAlign || 'center') as any,
                                        }}
                                    >
                                        <motion.div
                                            key={`${activeClip.id}:${activeClip.startTime}`}
                                            initial={{ opacity: 0, y: 18, filter: 'blur(10px)' }}
                                            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                                            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                                        >
                                            <div
                                                style={{
                                                    fontFamily: activeClip.titleStyle?.fontFamily || 'Inter, ui-sans-serif, system-ui',
                                                    fontSize: `${activeClip.titleStyle?.fontSize ?? 64}px`,
                                                    fontWeight: 800,
                                                    lineHeight: 1.05,
                                                    letterSpacing: '-0.02em',
                                                    color: activeClip.titleStyle?.textColor || '#ffffff',
                                                    textShadow: '0 12px 40px rgba(0,0,0,0.45)',
                                                }}
                                            >
                                                {activeClip.text || 'Title'}
                                            </div>
                                            <motion.div
                                                initial={{ scaleX: 0, opacity: 0 }}
                                                animate={{ scaleX: 1, opacity: 1 }}
                                                transition={{ delay: 0.12, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                                                className="mt-4 h-[3px] w-16 rounded-full"
                                                style={{
                                                    background: 'linear-gradient(90deg, rgba(236,72,153,0.95) 0%, rgba(99,102,241,0.95) 100%)',
                                                    transformOrigin: '0% 50%',
                                                }}
                                            />
                                        </motion.div>
                                    </div>
                                </div>
                            ) : activeClip.source ? (
                                <video 
                                    ref={videoRef}
                                    src={activeClip.source}
                                    className="w-full h-full object-contain"
                                    muted
                                    playsInline
                                />
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-zinc-500">No Video Source</span>
                                </div>
                            )}

                        </motion.div>
                    </div>
                </motion.div>
            </motion.div>
            ) : (
                <motion.div 
                    key="empty"
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }}
                    className="absolute inset-0 flex flex-col items-center justify-center gap-4 opacity-50"
                >
                    <VideoOff className="w-16 h-16 text-zinc-700" />
                    <p className="text-zinc-500 font-mono text-sm">NO SIGNAL</p>
                </motion.div>
            )}
        </AnimatePresence>

        {showCamera && <CameraBubble />}

        <AnimatePresence>
            {showKeystrokes && activeKey && (
                <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    className="absolute bottom-16 left-1/2 -translate-x-1/2 z-[70] bg-zinc-950/90 border border-zinc-800 text-white px-6 py-3 rounded-xl shadow-2xl backdrop-blur-md flex items-center gap-2 min-w-[120px] justify-center"
                >
                    <span className="text-xl font-bold font-mono tracking-tight">{activeKey}</span>
                </motion.div>
            )}
        </AnimatePresence>
      </div>
    </div>
  );
});
