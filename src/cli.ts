#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { ModernPatchPackage } from './patch';
import { detectPackageManager } from './utils';
import { PatchOptions } from './types';

const program = new Command();

program
  .name('modern-patch-package')
  .description(
    'A modern patch package that works with Yarn (all versions), pnpm, and npm'
  )
  .version('1.0.0');

// Create patch command
program
  .command('create <package-name>')
  .description('Create a patch for a specific package')
  .option('-d, --patch-dir <dir>', 'Directory to store patch files', 'patches')
  .option(
    '-e, --exclude <patterns...>',
    'Exclude files matching these patterns'
  )
  .option(
    '-i, --include <patterns...>',
    'Include only files matching these patterns'
  )
  .option('-c, --case-sensitive', 'Make regex patterns case-sensitive')
  .option('--create-issue', 'Create a GitHub issue for the patch')
  .option('--append <description>', 'Append a new patch with description')
  .option('--rebase <patch-file>', 'Rebase patches')
  .option('--partial', 'Apply patches partially')
  .action(async (packageName: string, options: any) => {
    try {
      const patchOptions: PatchOptions = {
        packageName,
        patchDir: options.patchDir,
        exclude: options.exclude,
        include: options.include,
        caseSensitive: options.caseSensitive,
        createIssue: options.createIssue,
        append: options.append,
        rebase: options.rebase,
        partial: options.partial,
      };

      const patcher = new ModernPatchPackage(patchOptions);
      const result = await patcher.createPatch(packageName);

      if (result.success) {
        console.log(chalk.green('✓ Patch created successfully'));
        process.exit(0);
      } else {
        console.error(chalk.red('✗ Failed to create patch'));
        result.errors.forEach(error =>
          console.error(chalk.red(`  - ${error}`))
        );
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${error}`));
      process.exit(1);
    }
  });

// Apply patches command
program
  .command('apply')
  .description('Apply all patches in the project')
  .option(
    '-d, --patch-dir <dir>',
    'Directory containing patch files',
    'patches'
  )
  .option('--error-on-fail', 'Exit with error code on failure')
  .option('--reverse', 'Reverse all patches')
  .action(async (options: any) => {
    try {
      const patchOptions: PatchOptions = {
        patchDir: options.patchDir,
        errorOnFail: options.errorOnFail,
        reverse: options.reverse,
      };

      const patcher = new ModernPatchPackage(patchOptions);
      const result = options.reverse
        ? await patcher.reversePatches()
        : await patcher.applyPatches();

      if (result.success) {
        console.log(chalk.green('✓ Patches processed successfully'));
        process.exit(0);
      } else {
        console.error(chalk.red('✗ Failed to process patches'));
        result.errors.forEach(error =>
          console.error(chalk.red(`  - ${error}`))
        );
        process.exit(options.errorOnFail ? 1 : 0);
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${error}`));
      process.exit(1);
    }
  });

// List patches command
program
  .command('list')
  .description('List all patches in the project')
  .option(
    '-d, --patch-dir <dir>',
    'Directory containing patch files',
    'patches'
  )
  .action(async (options: any) => {
    try {
      const patcher = new ModernPatchPackage({ patchDir: options.patchDir });
      const patches = await patcher.listPatches();

      if (patches.length === 0) {
        console.log(chalk.yellow('No patches found'));
        return;
      }

      console.log(chalk.blue('Patches:'));
      patches.forEach(patch => {
        const sequence = patch.sequence ? ` (${patch.sequence})` : '';
        const description = patch.description ? ` - ${patch.description}` : '';
        console.log(
          `  ${chalk.green(patch.packageName)}@${chalk.cyan(patch.packageVersion)}${chalk.yellow(sequence)}${description}`
        );
      });
    } catch (error) {
      console.error(chalk.red(`Error: ${error}`));
      process.exit(1);
    }
  });

// Info command
program
  .command('info')
  .description('Show information about the current project')
  .action(async () => {
    try {
      const packageManager = await detectPackageManager();

      console.log(chalk.blue('Project Information:'));
      console.log(
        `  Package Manager: ${chalk.green(packageManager.name)} ${chalk.cyan(packageManager.version)}`
      );
      console.log(`  Lock File: ${chalk.yellow(packageManager.lockFile)}`);
      console.log(
        `  Has Lock File: ${chalk.cyan(packageManager.hasLockFile ? 'Yes' : 'No')}`
      );

      const patcher = new ModernPatchPackage();
      const patches = await patcher.listPatches();
      console.log(`  Patches: ${chalk.cyan(patches.length)}`);
    } catch (error) {
      console.error(chalk.red(`Error: ${error}`));
      process.exit(1);
    }
  });

// Default command (apply patches)
program.action(async () => {
  try {
    console.log(chalk.blue('Applying patches...'));

    const patcher = new ModernPatchPackage();
    const result = await patcher.applyPatches();

    if (result.success) {
      console.log(chalk.green('✓ Patches applied successfully'));
      process.exit(0);
    } else {
      console.error(chalk.red('✗ Failed to apply patches'));
      result.errors.forEach(error => console.error(chalk.red(`  - ${error}`)));
      process.exit(1);
    }
  } catch (error) {
    console.error(chalk.red(`Error: ${error}`));
    process.exit(1);
  }
});

// Handle errors
program.exitOverride();

try {
  program.parse();
} catch (err: any) {
  if (err.code === 'commander.help') {
    process.exit(0);
  }
  console.error(chalk.red(`Error: ${err.message}`));
  process.exit(1);
}
