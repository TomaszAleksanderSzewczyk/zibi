import { GridLayout, ScreenInfo, WindowPosition } from './types';

const GAP = 10;

export function calculateOptimalGrid(count: number): { rows: number; cols: number } {
  if (count <= 0) {
    return { rows: 1, cols: 1 };
  }

  const sqrt = Math.sqrt(count);
  let cols = Math.ceil(sqrt);
  let rows = Math.ceil(count / cols);

  // Prefer wider layouts (more columns than rows)
  if (rows > cols && rows * (cols - 1) >= count) {
    cols = cols - 1;
    rows = Math.ceil(count / cols);
  }

  return { rows, cols };
}

export function calculateWindowPositions(
  screenInfo: ScreenInfo,
  count: number
): GridLayout {
  const { rows, cols } = calculateOptimalGrid(count);

  const totalGapX = GAP * (cols + 1);
  const totalGapY = GAP * (rows + 1);

  const windowWidth = Math.floor((screenInfo.workAreaWidth - totalGapX) / cols);
  const windowHeight = Math.floor((screenInfo.workAreaHeight - totalGapY) / rows);

  const positions: WindowPosition[] = [];

  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;

    const x = screenInfo.workAreaX + GAP + col * (windowWidth + GAP);
    const y = screenInfo.workAreaY + GAP + row * (windowHeight + GAP);

    positions.push({
      x,
      y,
      width: windowWidth,
      height: windowHeight,
    });
  }

  return { rows, cols, positions };
}
