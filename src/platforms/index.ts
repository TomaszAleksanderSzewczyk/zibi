import * as os from 'os';
import { Platform, PlatformAdapter } from '../types';
import { WindowsAdapter } from './windows';
import { MacOSAdapter } from './macos';

export function detectPlatform(): Platform {
  const platform = os.platform();

  switch (platform) {
    case 'win32':
      return 'windows';
    case 'darwin':
      return 'macos';
    case 'linux':
      return 'linux';
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

export function getPlatformAdapter(): PlatformAdapter {
  const platform = detectPlatform();

  switch (platform) {
    case 'windows':
      return new WindowsAdapter();
    case 'macos':
      return new MacOSAdapter();
    case 'linux':
      throw new Error('Linux support is not yet implemented');
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}
