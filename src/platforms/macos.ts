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

-- Account for menu bar (approximately 25 pixels) and dock
-- Dock height varies, we estimate 70 pixels for safety
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
      // Fallback to reasonable defaults
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
    const absoluteWorkingDir = path.resolve(workingDir);

    // Try iTerm2 first, fall back to Terminal.app
    const hasiTerm = await this.checkiTerm();

    if (hasiTerm) {
      await this.openiTermWindow(position, absoluteWorkingDir, command, index);
    } else {
      await this.openTerminalAppWindow(position, absoluteWorkingDir, command, index);
    }
  }

  private async checkiTerm(): Promise<boolean> {
    try {
      const script = `
tell application "System Events"
  return exists (application process "iTerm2")
end tell
`;
      await execa('osascript', ['-e', script]);
      return true;
    } catch {
      return false;
    }
  }

  private async openiTermWindow(
    position: WindowPosition,
    workingDir: string,
    command: string,
    index: number
  ): Promise<void> {
    const script = `
tell application "iTerm"
  activate
  set newWindow to (create window with default profile)
  tell newWindow
    tell current session
      write text "cd '${workingDir.replace(/'/g, "\\'")}' && ${command.replace(/'/g, "\\'")}"
    end tell
  end tell

  -- Position the window
  set bounds of newWindow to {${position.x}, ${position.y}, ${position.x + position.width}, ${position.y + position.height}}
end tell
`;

    await execa('osascript', ['-e', script]);
  }

  private async openTerminalAppWindow(
    position: WindowPosition,
    workingDir: string,
    command: string,
    index: number
  ): Promise<void> {
    const script = `
tell application "Terminal"
  activate

  -- Open new window with command
  do script "cd '${workingDir.replace(/'/g, "\\'")}' && ${command.replace(/'/g, "\\'")}"

  -- Get the window we just created (it will be the frontmost)
  delay 0.3
  set newWindow to front window

  -- Position the window
  set bounds of newWindow to {${position.x}, ${position.y}, ${position.x + position.width}, ${position.y + position.height}}
end tell
`;

    await execa('osascript', ['-e', script]);
  }
}
