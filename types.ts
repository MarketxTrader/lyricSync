export enum AppState {
  IDLE = 'IDLE',
  PROCESSING = 'PROCESSING',
  READY = 'READY',
  ERROR = 'ERROR'
}

export interface AudioMetadata {
  name: string;
  size: number;
  type: string;
  duration?: number;
}
