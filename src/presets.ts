import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Preset, PresetsConfig } from './types';

const CONFIG_DIR = path.join(os.homedir(), '.zibi');
const PRESETS_FILE = path.join(CONFIG_DIR, 'presets.json');

function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

function loadConfig(): PresetsConfig {
  ensureConfigDir();

  if (!fs.existsSync(PRESETS_FILE)) {
    return { presets: [] };
  }

  try {
    const content = fs.readFileSync(PRESETS_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return { presets: [] };
  }
}

function saveConfig(config: PresetsConfig): void {
  ensureConfigDir();
  fs.writeFileSync(PRESETS_FILE, JSON.stringify(config, null, 2));
}

export function savePreset(preset: Preset): void {
  const config = loadConfig();
  const existingIndex = config.presets.findIndex(p => p.name === preset.name);

  if (existingIndex >= 0) {
    config.presets[existingIndex] = preset;
  } else {
    config.presets.push(preset);
  }

  saveConfig(config);
  console.log(`Preset "${preset.name}" saved successfully.`);
}

export function loadPreset(name: string): Preset | null {
  const config = loadConfig();
  return config.presets.find(p => p.name === name) || null;
}

export function listPresets(): Preset[] {
  const config = loadConfig();
  return config.presets;
}

export function deletePreset(name: string): boolean {
  const config = loadConfig();
  const initialLength = config.presets.length;
  config.presets = config.presets.filter(p => p.name !== name);

  if (config.presets.length < initialLength) {
    saveConfig(config);
    console.log(`Preset "${name}" deleted successfully.`);
    return true;
  }

  console.log(`Preset "${name}" not found.`);
  return false;
}
