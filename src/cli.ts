import { Command } from 'commander';
import { ZibiOptions, Preset } from './types';
import { savePreset, loadPreset, listPresets, deletePreset } from './presets';
import { runZibi } from './index';

const program = new Command();

program
  .name('zibi')
  .description('Terminal Manager CLI - Open multiple Claude Code instances in a grid layout')
  .version('1.0.0');

program
  .option('-c, --count <number>', 'Number of terminal instances to open', '1')
  .option('-f, --folder <path>', 'Working directory for all instances', '.')
  .option('--command <cmd>', 'Command to run in each terminal', 'claude')
  .action(async (options) => {
    const zibiOptions: ZibiOptions = {
      count: parseInt(options.count, 10),
      folder: options.folder,
      command: options.command,
    };

    if (isNaN(zibiOptions.count) || zibiOptions.count < 1) {
      console.error('Error: Count must be a positive number');
      process.exit(1);
    }

    await runZibi(zibiOptions);
  });

program
  .command('save <name>')
  .description('Save current options as a preset')
  .option('-c, --count <number>', 'Number of terminal instances', '1')
  .option('-f, --folder <path>', 'Working directory', '.')
  .option('--command <cmd>', 'Command to run', 'claude')
  .action((name, options) => {
    const preset: Preset = {
      name,
      count: parseInt(options.count, 10),
      folder: options.folder,
      command: options.command,
    };

    if (isNaN(preset.count) || preset.count < 1) {
      console.error('Error: Count must be a positive number');
      process.exit(1);
    }

    savePreset(preset);
  });

program
  .command('load <name>')
  .description('Load and run a saved preset')
  .action(async (name) => {
    const preset = loadPreset(name);

    if (!preset) {
      console.error(`Error: Preset "${name}" not found`);
      process.exit(1);
    }

    console.log(`Loading preset "${name}"...`);
    console.log(`  Count: ${preset.count}`);
    console.log(`  Folder: ${preset.folder}`);
    console.log(`  Command: ${preset.command || 'claude'}`);

    await runZibi({
      count: preset.count,
      folder: preset.folder,
      command: preset.command,
    });
  });

program
  .command('list')
  .description('List all saved presets')
  .action(() => {
    const presets = listPresets();

    if (presets.length === 0) {
      console.log('No presets saved yet.');
      console.log('Use "zibi save <name> -c <count> -f <folder>" to create one.');
      return;
    }

    console.log('Saved presets:');
    console.log('');
    presets.forEach(preset => {
      console.log(`  ${preset.name}`);
      console.log(`    Count: ${preset.count}`);
      console.log(`    Folder: ${preset.folder}`);
      console.log(`    Command: ${preset.command || 'claude'}`);
      console.log('');
    });
  });

program
  .command('delete <name>')
  .description('Delete a saved preset')
  .action((name) => {
    deletePreset(name);
  });

export function runCLI(): void {
  program.parse();
}
