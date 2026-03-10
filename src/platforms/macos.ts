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
      if (stdout.trim() === 'true') return true;
    } catch {
      // ignore
    }

    // Check if iTerm.app is installed even if not running
    try {
      await execa('test', ['-d', '/Applications/iTerm.app']);
      return true;
    } catch {
      return false;
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

    // Build a single AppleScript that creates the window and all split panes
    const lines: string[] = [
      'tell application "iTerm"',
      '  activate',
      '  delay 1',
      `  create window with default profile command "/bin/bash -c '${shellCmd}'"`,
      '  delay 2',
      '  set w to first window',
      `  set bounds of w to {${screenInfo.workAreaX}, ${screenInfo.workAreaY}, ${screenInfo.workAreaX + screenInfo.workAreaWidth}, ${screenInfo.workAreaY + screenInfo.workAreaHeight}}`,
    ];

    let created = 1;

    // Step 1: Create rows by splitting horizontally
    for (let row = 1; row < rows && created < count; row++) {
      lines.push('  tell current session of current tab of w');
      lines.push(`    split horizontally with default profile command "/bin/bash -c '${shellCmd}'"`);
      lines.push('  end tell');
      lines.push('  delay 0.5');
      created++;
    }

    // Step 2: Split each row vertically to create columns
    // After horizontal splits, sessions 1..rows are the rows (top to bottom)
    for (let row = 0; row < rows && created < count; row++) {
      for (let col = 1; col < cols && created < count; col++) {
        lines.push(`  tell session ${row + 1} of current tab of w`);
        lines.push(`    split vertically with default profile command "/bin/bash -c '${shellCmd}'"`);
        lines.push('  end tell');
        lines.push('  delay 0.5');
        created++;
      }
    }

    lines.push('end tell');

    const script = lines.join('\n');

    try {
      await execa('osascript', ['-e', script]);
    } catch (error: any) {
      console.error(`  iTerm2 failed: ${error.stderr || error.message}`);
      console.error(`  Falling back to tmux in Terminal.app...`);
      await this.openTerminalAppWindows(count, workingDir, command, screenInfo);
    }
  }

  private async openTerminalAppWindows(
    count: number,
    workingDir: string,
    command: string,
    screenInfo: ScreenInfo
  ): Promise<void> {
    // Check if tmux is available
    try {
      await execa('which', ['tmux']);
    } catch {
      console.error('  tmux is not installed. Install it with: brew install tmux');
      process.exit(1);
    }

    const { rows, cols } = this.calculateGrid(count);
    const sessionName = `zibi-${Date.now()}`;
    const escapedDir = workingDir.replace(/'/g, "'\\''");
    const escapedCmd = command.replace(/'/g, "'\\''");
    const paneCmd = `cd '${escapedDir}' && unset CLAUDECODE && ${escapedCmd}`;

    console.log(`  Opening Terminal.app with tmux ${cols}x${rows} panes...`);

    // Create tmux session with first pane
    await execa('tmux', ['new-session', '-d', '-s', sessionName, '-x', '250', '-y', '50', paneCmd]);

    let created = 1;

    // Create columns by splitting horizontally (left-right in tmux)
    for (let col = 1; col < cols && created < count; col++) {
      await execa('tmux', ['split-window', '-h', '-t', sessionName, paneCmd]);
      created++;
    }

    // Even out the columns
    await execa('tmux', ['select-layout', '-t', sessionName, 'even-horizontal']);

    // Split each column vertically (top-bottom in tmux) to create rows
    for (let col = 0; col < cols && created < count; col++) {
      // Select the pane for this column
      await execa('tmux', ['select-pane', '-t', `${sessionName}:.${col}`]);
      for (let row = 1; row < rows && created < count; row++) {
        await execa('tmux', ['split-window', '-v', '-t', sessionName, paneCmd]);
        created++;
      }
    }

    // Apply tiled layout for even distribution
    await execa('tmux', ['select-layout', '-t', sessionName, 'tiled']);

    // Open Terminal.app and attach to the tmux session
    const shellCmd = `tmux attach-session -t ${sessionName}`;
    const script = [
      'tell application "Terminal"',
      '  activate',
      `  do script "${shellCmd}"`,
      '  delay 0.5',
      `  set bounds of front window to {${screenInfo.workAreaX}, ${screenInfo.workAreaY}, ${screenInfo.workAreaX + screenInfo.workAreaWidth}, ${screenInfo.workAreaY + screenInfo.workAreaHeight}}`,
      'end tell',
    ].join('\n');

    await execa('osascript', ['-e', script]);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
