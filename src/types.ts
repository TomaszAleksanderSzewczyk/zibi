export interface WindowPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScreenInfo {
  width: number;
  height: number;
  workAreaX: number;
  workAreaY: number;
  workAreaWidth: number;
  workAreaHeight: number;
}

export interface GridLayout {
  rows: number;
  cols: number;
  positions: WindowPosition[];
}

export interface ZibiOptions {
  count: number;
  folder: string;
  command?: string;
}

export interface Preset {
  name: string;
  count: number;
  folder: string;
  command?: string;
}

export interface PresetsConfig {
  presets: Preset[];
}

export interface PlatformAdapter {
  getScreenInfo(): Promise<ScreenInfo>;
  openTerminal(position: WindowPosition, workingDir: string, command: string, index: number): Promise<void>;
  openAllTerminals?(count: number, workingDir: string, command: string, screenInfo: ScreenInfo): Promise<void>;
}

export type Platform = 'windows' | 'macos' | 'linux';
