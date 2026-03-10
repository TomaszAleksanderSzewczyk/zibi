import { execa } from 'execa';
import { PlatformAdapter, ScreenInfo, WindowPosition } from '../types';
import * as path from 'path';

export class WindowsAdapter implements PlatformAdapter {
  async getScreenInfo(): Promise<ScreenInfo> {
    const script = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class ScreenInfo {
    [DllImport("user32.dll")]
    public static extern bool SystemParametersInfo(int uAction, int uParam, ref RECT lpvParam, int fuWinIni);

    [DllImport("user32.dll")]
    public static extern int GetSystemMetrics(int nIndex);

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    public static void GetWorkArea() {
        RECT workArea = new RECT();
        SystemParametersInfo(48, 0, ref workArea, 0);
        int screenWidth = GetSystemMetrics(0);
        int screenHeight = GetSystemMetrics(1);
        Console.WriteLine(screenWidth);
        Console.WriteLine(screenHeight);
        Console.WriteLine(workArea.Left);
        Console.WriteLine(workArea.Top);
        Console.WriteLine(workArea.Right - workArea.Left);
        Console.WriteLine(workArea.Bottom - workArea.Top);
    }
}
"@
[ScreenInfo]::GetWorkArea()
`;

    const { stdout } = await execa('powershell', ['-Command', script]);
    const lines = stdout.trim().split(/\r?\n/);

    return {
      width: parseInt(lines[0], 10),
      height: parseInt(lines[1], 10),
      workAreaX: parseInt(lines[2], 10),
      workAreaY: parseInt(lines[3], 10),
      workAreaWidth: parseInt(lines[4], 10),
      workAreaHeight: parseInt(lines[5], 10),
    };
  }

  async openTerminal(
    position: WindowPosition,
    workingDir: string,
    command: string,
    index: number
  ): Promise<void> {
    // This method is not used anymore - we use openAllTerminals instead
  }

  async openAllTerminals(
    count: number,
    workingDir: string,
    command: string,
    screenInfo: ScreenInfo
  ): Promise<void> {
    const absoluteWorkingDir = path.resolve(workingDir).replace(/\//g, '\\');

    // Build Windows Terminal command with split panes
    const wtCommand = this.buildWtCommand(count, absoluteWorkingDir, command);

    console.log(`  Running: wt ${wtCommand}`);

    try {
      await execa('powershell.exe', [
        '-Command',
        `Start-Process wt -ArgumentList '${wtCommand.replace(/'/g, "''")}'`
      ]);

      // Wait for window to open
      await this.sleep(1500);

      // Maximize the Windows Terminal window
      await this.maximizeWindow(screenInfo);

    } catch (error) {
      console.error('Failed to open Windows Terminal:', error);
      throw error;
    }
  }

  private buildWtCommand(count: number, workingDir: string, command: string): string {
    // Escape the working directory and command for PowerShell
    const escapedDir = workingDir.replace(/"/g, '`"');
    const escapedCmd = command.replace(/"/g, '`"');

    // Clear CLAUDECODE env var to allow nested Claude sessions
    const paneCmd = `-d "${escapedDir}" cmd /k "set CLAUDECODE= && ${escapedCmd}"`;

    if (count === 1) {
      return paneCmd;
    }

    // Calculate grid layout
    const { rows, cols } = this.calculateGrid(count);

    // Build command with splits
    // Strategy: Create columns first, then split each column into rows
    const parts: string[] = [paneCmd]; // First pane

    let paneIndex = 1;

    // Create additional columns (vertical splits from first pane)
    for (let col = 1; col < cols && paneIndex < count; col++) {
      parts.push(`; split-pane -V ${paneCmd}`);
      paneIndex++;
    }

    // Now split each column into rows (horizontal splits)
    // We need to navigate to each column and split horizontally
    for (let row = 1; row < rows; row++) {
      for (let col = 0; col < cols && paneIndex < count; col++) {
        // Move to the correct pane and split
        // After vertical splits, panes are numbered 0, 1, 2... from left to right
        // We need to focus the correct pane and split horizontally
        const targetPane = col;
        parts.push(`; move-focus first`);
        for (let i = 0; i < targetPane; i++) {
          parts.push(`; move-focus right`);
        }
        // Move down to find the last pane in this column
        for (let r = 0; r < row - 1; r++) {
          parts.push(`; move-focus down`);
        }
        parts.push(`; split-pane -H ${paneCmd}`);
        paneIndex++;
      }
    }

    return parts.join(' ');
  }

  private calculateGrid(count: number): { rows: number; cols: number } {
    if (count <= 0) return { rows: 1, cols: 1 };
    if (count === 1) return { rows: 1, cols: 1 };
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

  private async maximizeWindow(screenInfo: ScreenInfo): Promise<void> {
    // Find and maximize the Windows Terminal window
    const script = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class WindowManager {
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    public static IntPtr FindWindowTerminal() {
        IntPtr result = IntPtr.Zero;
        EnumWindows((hWnd, lParam) => {
            if (!IsWindowVisible(hWnd)) return true;
            StringBuilder sb = new StringBuilder(256);
            GetWindowText(hWnd, sb, 256);
            string title = sb.ToString();
            if (title.Contains("Windows Terminal") || title.Contains("WindowsTerminal")) {
                result = hWnd;
                return false;
            }
            return true;
        }, IntPtr.Zero);
        return result;
    }
}
"@

$hwnd = [WindowManager]::FindWindowTerminal()
if ($hwnd -eq [IntPtr]::Zero) {
    $hwnd = [WindowManager]::GetForegroundWindow()
}
if ($hwnd -ne [IntPtr]::Zero) {
    [WindowManager]::ShowWindow($hwnd, 3)
    [WindowManager]::MoveWindow($hwnd, ${screenInfo.workAreaX}, ${screenInfo.workAreaY}, ${screenInfo.workAreaWidth}, ${screenInfo.workAreaHeight}, $true)
    Write-Host "Maximized"
} else {
    Write-Host "NotFound"
}
`;

    try {
      const { stdout } = await execa('powershell.exe', ['-Command', script]);
      console.log(`  Window: ${stdout.trim()}`);
    } catch (error) {
      console.error('  Failed to maximize window');
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
