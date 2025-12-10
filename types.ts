export interface DialogueLine {
  speaker: string;
  text: string;
  emotion: 'normal' | 'happy' | 'angry' | 'surprised' | 'shy' | 'proud';
  note?: string; // For technical terms explanation
}

export interface PaperAnalysisResponse {
  title: string;
  script: DialogueLine[];
}

export enum GameState {
  IDLE,
  PROCESSING,
  PLAYING,
  PAUSED,
}