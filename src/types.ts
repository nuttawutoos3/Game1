export interface KeyBindings {
  up: string;
  down: string;
  left: string;
  right: string;
  action: string;
}

export type ThemePalette = 'cyberpink' | 'emerald' | 'amethyst' | 'classic';

export interface GameSettings {
  bindings: KeyBindings;
  soundVolume: number;
  musicVolume: number;
  scanlines: boolean;
  difficulty: 'easy' | 'medium' | 'hard';
  theme: ThemePalette;
}

export type GameScreenState = 'TITLE' | 'OPTIONS' | 'PLAYING' | 'HOW_TO_PLAY' | 'GAME_OVER';

export interface HighScore {
  name: string;
  score: number;
  date: string;
}
