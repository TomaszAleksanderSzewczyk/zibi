import { execa } from 'execa';
import { PlatformAdapter, ScreenInfo, WindowPosition } from '../types';
import * as path from 'path';

export class MacOSAdapter implements PlatformAdapter {
  async getScreenInfo(): Promise<ScreenInfo> {
    const script = `
tell application "Finder"
  set screenBounds to bounds of window of desktop
  set screenWidth to item 3 of screenBounds
  set screenHeight to item 4 of screenBounds
end tell

set menuBarHeight to 25
set dockHeight to 70

set workAreaX to 0
set workAreaY to menuBarHeight
set workAreaWidth to screenWidth
set workAreaHeight to screenHeight - menuBarHeight - dockHeight

return (screenWidth as string) & "," & (screenHeight as string) & "," & (workAreaX as string) & "," & (workAreaY as string) & "," & (workAreaWidth as string) & "," & (workAreaHeight as string)
`;

    try {
      const { stdout } = await execa('osascript', ['-e', script]);
      const parts = stdout.trim().split(',');

      return {
        width: parseInt(parts[0], 10),
        height: parseInt(parts[1], 10),
        workAreaX: parseInt(parts[2], 10),
        workAreaY: parseInt(parts[3], 10),
        workAreaWidth: parseInt(parts[4], 10),
        workAreaHeight: parseInt(parts[5], 10),
      };
    } catch {
      return {
        width: 1920,
        height: 1080,
        workAreaX: 0,
        workAreaY: 25,
        workAreaWidth: 1920,
        workAreaHeight: 985,
      };
    }
  }

  async openTerminal(
    position: WindowPosition,
    workingDir: string,
    command: string,
    index: number
  ): Promise<void> {
    // Not used - openAllTerminals handles everything
  }

  async openAllTerminals(
    count: number,
    workingDir: string,
    command: string,
    screenInfo: ScreenInfo
  ): Promise<void> {
    const absoluteWorkingDir = path.resolve(workingDir);
    const hasiTerm = await this.checkiTerm();

    if (hasiTerm) {
      await this.openiTermSplitPanes(count, absoluteWorkingDir, command, screenInfo);
    } else {
      await this.openTerminalAppWindows(count, absoluteWorkingDir, command, screenInfo);
    }
  }

  private async checkiTerm(): Promise<boolean> {
    try {
      const { stdout } = await execa('osascript', ['-e',
        'tell application "System Events" to return (exists (application process "iTerm2")) as string'
      ]);
      return stdout.trim() === 'true';
    } catch {
      try {
        await execa('test', ['-d', '/Applications/iTerm.app']);
        return true;
      } catch {
        return false;
      }
    }
  }

  private calculateGrid(count: number): { rows: number; cols: number } {
    if (count <= 1) return { rows: 1, cols: 1 };
    if (count === 2) return { rows: 1, cols: 2 };
    if (count === 3) return { rows: 1, cols: 3 };
    if (count === 4) return { rows: 2, cols: 2 };
    if (count <= 6) return { rows: 2, cols: 3 };
    if (count <= 8) return { rows: 2, cols: 4 };
    if (count <= 9) return { rows: 3, cols: 3 };
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    return { rows, cols };
  }

  // Build a shell command that's safe to embed in AppleScript single-quoted strings
  private buildShellCmd(workingDir: string, command: string): string {
    // Use single quotes in AppleScript, so we escape single quotes in bash with '\''
    const escapedDir = workingDir.replace(/'/g, "'\\''");
    const escapedCmd = command.replace(/'/g, "'\\''");
    return `cd '${escapedDir}' && unset CLAUDECODE && ${escapedCmd}`;
  }

  private async openiTermSplitPanes(
    count: number,
    workingDir: string,
    command: string,
    screenInfo: ScreenInfo
  ): Promise<void> {
    const { rows, cols } = this.calculateGrid(count);
    const shellCmd = this.buildShellCmd(workingDir, command);

    console.log(`  Opening iTerm2 with ${cols}x${rows} split panes...`);

    // Step 1: Create window with first session
    const createScript = [
      'tell application "iTerm2"',
      '  activate',
      `  create window with default profile command "/bin/bash -c '${shellCmd}'"`,
      '  tell current window',
      `    set bounds to {${screenInfo.workAreaX}, ${screenInfo.workAreaY}, ${screenInfo.workAreaX + screenInfo.workAreaWidth}, ${screenInfo.workAreaY + screenInfo.workAreaHeight}}`,
      '  end tell',
      'end tell',
    ].join('\n');

    try {
      await execa('osascript', ['-e', createScript]);
    } catch (error: any) {
      console.error(`  iTerm2 failed, falling back to Terminal.app...`);
      await this.openTerminalAppWindows(count, workingDir, command, screenInfo);
      return;
    }

    await this.sleep(500);
    let created = 1;

    // Step 2: Create columns by splitting vertically
    for (let col = 1; col < cols && created < count; col++) {
      const splitV = [
        'tell application "iTerm2"',
        '  tell current window',
        '    tell current session of current tab',
        `      split vertically with default profile command "/bin/bash -c '${shellCmd}'"`,
        '    end tell',
        '  end tell',
        'end tell',
      ].join('\n');

      await execa('osascript', ['-e', splitV]);
      created++;
      await this.sleep(300);
    }

    // Step 3: Split each column horizontally to create rows
    for (let col = 0; col < cols && created < count; col++) {
      for (let row = 1; row < rows && created < count; row++) {
        const splitH = [
          'tell application "iTerm2"',
          '  tell current window',
          `    tell session ${col + 1} of current tab`,
          `      split horizontally with default profile command "/bin/bash -c '${shellCmd}'"`,
          '    end tell',
          '  end tell',
          'end tell',
        ].join('\n');

        await execa('osascript', ['-e', splitH]);
        created++;
        await this.sleep(300);
      }
    }
  }

  private async openTerminalAppWindows(
    count: number,
    workingDir: string,
    command: string,
    screenInfo: ScreenInfo
  ): Promise<void> {
    const { rows, cols } = this.calculateGrid(count);
    const shellCmd = this.buildShellCmd(workingDir, command);

    // Terminal.app doesn't support split panes, open separate windows in grid
    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;

      const gap = 10;
      const totalGapX = gap * (cols + 1);
      const totalGapY = gap * (rows + 1);
      const winW = Math.floor((screenInfo.workAreaWidth - totalGapX) / cols);
      const winH = Math.floor((screenInfo.workAreaHeight - totalGapY) / rows);
      const x = screenInfo.workAreaX + gap + col * (winW + gap);
      const y = screenInfo.workAreaY + gap + row * (winH + gap);

      const script = [
        'tell application "Terminal"',
        '  activate',
        `  do script "/bin/bash -c '${shellCmd}'"`,
        '  delay 0.3',
        `  set bounds of front window to {${x}, ${y}, ${x + winW}, ${y + winH}}`,
        'end tell',
      ].join('\n');

      await execa('osascript', ['-e', script]);
      await this.sleep(300);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
