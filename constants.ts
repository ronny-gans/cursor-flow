import { AnimationPreset, PresetConfig } from './types';

export const PHYSICS_PRESETS: PresetConfig[] = [
  {
    name: AnimationPreset.SLOW,
    config: { stiffness: 50, damping: 20, mass: 1.5 }
  },
  {
    name: AnimationPreset.MELLOW,
    config: { stiffness: 100, damping: 15, mass: 1 }
  },
  {
    name: AnimationPreset.QUICK,
    config: { stiffness: 300, damping: 25, mass: 0.8 }
  },
  {
    name: AnimationPreset.RAPID,
    config: { stiffness: 600, damping: 30, mass: 0.5 }
  }
];

export const INITIAL_CONFIG = PHYSICS_PRESETS[1].config; // Mellow default