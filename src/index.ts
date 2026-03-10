import { ZibiOptions } from './types';
import { calculateWindowPositions } from './layout';
import { getPlatformAdapter, detectPlatform } from './platforms';
import { runCLI } from './cli';

export async function runZibi(options: ZibiOptions): Promise<void> {
  const { count, folder, command = 'claude' } = options;

  console.log(`Starting zibi...`);
  console.log(`  Platform: ${detectPlatform()}`);
  console.log(`  Instances: ${count}`);
  console.log(`  Folder: ${folder}`);
  console.log(`  Command: ${command}`);
  console.log('');

  const adapter = getPlatformAdapter();

  // Get screen information
  console.log('Getting screen information...');
  const screenInfo = await adapter.getScreenInfo();
  console.log(`  Screen: ${screenInfo.width}x${screenInfo.height}`);
  console.log(`  Work area: ${screenInfo.workAreaWidth}x${screenInfo.workAreaHeight} at (${screenInfo.workAreaX}, ${screenInfo.workAreaY})`);
  console.log('');

  // Open terminals
  console.log('Opening terminals...');

  // Use openAllTerminals if available (Windows Terminal with split panes)
  if (adapter.openAllTerminals) {
    try {
      await adapter.openAllTerminals(count, folder, command, screenInfo);
      console.log('');
      console.log('Done! Windows Terminal opened with split panes.');
    } catch (error) {
      console.error('Failed to open terminals:', error);
    }
  } else {
    // Fallback to individual windows
    const layout = calculateWindowPositions(screenInfo, count);
    console.log(`Grid layout: ${layout.cols}x${layout.rows}`);
    console.log('');

    for (let i = 0; i < count; i++) {
      const position = layout.positions[i];
      console.log(`  Opening terminal ${i + 1}/${count} at (${position.x}, ${position.y}) - ${position.width}x${position.height}`);

      try {
        await adapter.openTerminal(position, folder, command, i);
        await sleep(300);
      } catch (error) {
        console.error(`  Failed to open terminal ${i + 1}:`, error);
      }
    }
    console.log('');
    console.log('Done! All terminals opened.');
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Always run CLI when this module is loaded
runCLI();

export { runCLI };
