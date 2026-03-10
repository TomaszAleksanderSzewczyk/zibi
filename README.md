# zibi

Terminal Manager CLI - open multiple Claude Code instances in a single Windows Terminal window with split panes.

## Installation

```bash
git clone https://github.com/TomaszAleksanderSzewczyk/zibi.git
cd zibi
npm install
npm run build
npm link
```

## Usage

### Open Claude Code instances

```bash
# Open 4 Claude Code instances in a 2x2 grid
zibi -c 4 -f ./my-project

# Open 2 instances in current directory
zibi -c 2 -f .

# Open 6 instances with custom command
zibi -c 6 -f ./project --command "node"
```

### Presets

```bash
# Save a preset
zibi save my-project -c 4 -f ./my-project

# Load and run a preset
zibi load my-project

# List all presets
zibi list

# Delete a preset
zibi delete my-project
```

Presets are stored in `~/.zibi/presets.json`.

### Options

| Option | Short | Description | Default |
|---|---|---|---|
| `--count` | `-c` | Number of terminal instances | `1` |
| `--folder` | `-f` | Working directory | `.` |
| `--command` | | Command to run in each pane | `claude` |
| `--version` | `-V` | Show version | |
| `--help` | `-h` | Show help | |

## How it works

1. Detects the platform (Windows / macOS)
2. Gets screen work area dimensions
3. Opens a single Windows Terminal window with split panes arranged in an optimal grid
4. Runs the specified command (default: `claude`) in each pane
5. Maximizes the window to fill the screen

### Grid layouts

| Count | Layout |
|---|---|
| 1 | 1x1 |
| 2 | 1x2 |
| 3 | 1x3 |
| 4 | 2x2 |
| 5-6 | 2x3 |
| 7-8 | 2x4 |
| 9 | 3x3 |

## Requirements

- Node.js >= 18
- [Windows Terminal](https://aka.ms/terminal) (Windows)
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) (for default command)

## Development

```bash
npm run dev    # Watch mode
npm run build  # Production build
```

## License

MIT
