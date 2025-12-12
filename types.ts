
export interface PhysicsConfig {
  stiffness: number; // Tension
  damping: number;   // Friction
  mass: number;      // Mass
}

export enum AnimationPreset {
  SLOW = 'Slow',
  MELLOW = 'Mellow',
  QUICK = 'Quick',
  RAPID = 'Rapid',
  CUSTOM = 'Custom'
}

export type BackgroundStyle = 
  | 'grid' | 'solid'
  | 'sunset' | 'ocean' | 'cotton_candy' | 'aurora' 
  | 'midnight' | 'gunmetal' | 'iridescent' | 'peachy' 
  | 'cd' | 'hollywood' | 'sublime' | 'flamingo';

export interface PresetConfig {
  name: AnimationPreset;
  config: PhysicsConfig;
}

export interface ZoomEvent {
  id: string;
  startTime: number; // in seconds
  duration: number; // in seconds
  x: number; // % relative to container width
  y: number; // % relative to container height
  scale: number;
}

export type TitleTextAlign = 'left' | 'center' | 'right';

export interface TitleStyle {
  fontFamily: string;
  fontSize: number;
  textAlign: TitleTextAlign;
  textColor: string;
  background: string;
  posX: number;
  posY: number;
}

export type ClipType = 'video' | 'title';

export interface VideoClip {
  id: string;
  startTime: number;
  duration: number;
  name: string;
  type: ClipType;
  text?: string; // Only for 'title' type
  titleStyle?: TitleStyle; // Only for 'title' type
  source?: string; // URL for the video file (blob or remote)
  width?: number; // Original video width
  height?: number; // Original video height
}

export type DragState = 
  | { type: 'zoom' | 'clip'; id: string; mode: 'move' | 'resize'; startX: number; initialStart: number; initialDuration: number }
  | { type: 'playhead' };

export type AspectRatio = 'Auto' | '16:9' | '9:16' | '1:1' | '4:3' | '21:9';

export interface ProjectState {
  version: number;
  config: PhysicsConfig;
  currentPreset: AnimationPreset;
  blurEnabled: boolean;
  background: BackgroundStyle;
  backgroundBlur: number;
  showCamera: boolean;
  contentScale: number;
  borderRadius: number;
  aspectRatio: AspectRatio;
  showWindowFrame: boolean;
  showKeystrokes: boolean;
  zooms: ZoomEvent[];
  clips: VideoClip[];
}
