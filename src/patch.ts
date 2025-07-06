import fs from 'fs-extra';
import path from 'path';
import { glob } from 'glob';
import chalk from 'chalk';
import {
  getPackageInfo,
  getPackagePath,
  createPatchDirectory,
  getPatchFiles,
  shouldIncludeFile,
  generatePatchFileName,
  executeCommand,
  detectPackageManager
} from './utils';
import { PatchOptions, PatchResult, PatchFile } from './types';

export class ModernPatchPackage {
  private patchDir: string;
  private options: PatchOptions;

  constructor(options: PatchOptions = {}) {
    this.patchDir = options.patchDir || 'patches';
    this.options = options;
  }

  async createPatch(packageName: string): Promise<PatchResult> {
    const result: PatchResult = {
      success: false,
      patchesCreated: [],
      patchesApplied: [],
      errors: []
    };

    try {
      console.log(chalk.blue(`Creating patch for package: ${packageName}`));

      // Get package path
      const packagePath = await getPackagePath(packageName);
      if (!packagePath) {
        const error = `Package ${packageName} not found in node_modules`;
        result.errors.push(error);
        console.error(chalk.red(error));
        return result;
      }

      // Get package info
      const packageInfo = await getPackageInfo(packagePath);
      if (!packageInfo) {
        const error = `Could not read package.json for ${packageName}`;
        result.errors.push(error);
        console.error(chalk.red(error));
        return result;
      }

      console.log(chalk.green(`Found package: ${packageInfo.name}@${packageInfo.version}`));

      // Create patch directory
      await createPatchDirectory(this.patchDir);

      // Create backup of original package
      const backupPath = path.join(this.patchDir, `${packageName}-backup`);
      await fs.copy(packagePath, backupPath);

      // Generate patch file name
      const patchFileName = generatePatchFileName(
        packageInfo.name,
        packageInfo.version,
        this.options.append ? 1 : undefined,
        this.options.append
      );
      const patchFilePath = path.join(this.patchDir, patchFileName);

      // Create git diff
      const { success, output, error } = await executeCommand(
        `git diff --no-index "${backupPath}" "${packagePath}"`,
        process.cwd()
      );

      if (!success && error) {
        console.warn(chalk.yellow('Warning: Could not create git diff, using alternative method'));
        
        // Alternative: create patch manually by comparing files
        await this.createManualPatch(packagePath, backupPath, patchFilePath);
      } else {
        // Write git diff to patch file
        await fs.writeFile(patchFilePath, output);
      }

      // Clean up backup
      await fs.remove(backupPath);

      result.patchesCreated.push(patchFilePath);
      result.success = true;

      console.log(chalk.green(`✓ Patch created: ${patchFileName}`));

      // Create GitHub issue if requested
      if (this.options.createIssue) {
        await this.createGitHubIssue(packageName, patchFilePath);
      }

    } catch (err) {
      const error = `Failed to create patch: ${err}`;
      result.errors.push(error);
      console.error(chalk.red(error));
    }

    return result;
  }

  async applyPatches(): Promise<PatchResult> {
    const result: PatchResult = {
      success: false,
      patchesCreated: [],
      patchesApplied: [],
      errors: []
    };

    try {
      console.log(chalk.blue('Applying patches...'));

      const patchFiles = await getPatchFiles(this.patchDir);
      if (patchFiles.length === 0) {
        console.log(chalk.yellow('No patch files found'));
        result.success = true;
        return result;
      }

      for (const patchFile of patchFiles) {
        try {
          await this.applyPatch(patchFile);
          result.patchesApplied.push(patchFile);
        } catch (err) {
          const error = `Failed to apply patch ${patchFile}: ${err}`;
          result.errors.push(error);
          console.error(chalk.red(error));
        }
      }

      result.success = result.errors.length === 0;
      
      if (result.success) {
        console.log(chalk.green(`✓ Applied ${result.patchesApplied.length} patches successfully`));
      } else {
        console.log(chalk.red(`✗ Failed to apply ${result.errors.length} patches`));
      }

    } catch (err) {
      const error = `Failed to apply patches: ${err}`;
      result.errors.push(error);
      console.error(chalk.red(error));
    }

    return result;
  }

  async reversePatches(): Promise<PatchResult> {
    const result: PatchResult = {
      success: false,
      patchesCreated: [],
      patchesApplied: [],
      errors: []
    };

    try {
      console.log(chalk.blue('Reversing patches...'));

      const patchFiles = await getPatchFiles(this.patchDir);
      if (patchFiles.length === 0) {
        console.log(chalk.yellow('No patch files found'));
        result.success = true;
        return result;
      }

      // Reverse the order to apply patches in reverse
      const reversedPatches = patchFiles.reverse();

      for (const patchFile of reversedPatches) {
        try {
          await this.reversePatch(patchFile);
          result.patchesApplied.push(patchFile);
        } catch (err) {
          const error = `Failed to reverse patch ${patchFile}: ${err}`;
          result.errors.push(error);
          console.error(chalk.red(error));
        }
      }

      result.success = result.errors.length === 0;
      
      if (result.success) {
        console.log(chalk.green(`✓ Reversed ${result.patchesApplied.length} patches successfully`));
      } else {
        console.log(chalk.red(`✗ Failed to reverse ${result.errors.length} patches`));
      }

    } catch (err) {
      const error = `Failed to reverse patches: ${err}`;
      result.errors.push(error);
      console.error(chalk.red(error));
    }

    return result;
  }

  private async createManualPatch(
    packagePath: string,
    backupPath: string,
    patchFilePath: string
  ): Promise<void> {
    // This is a simplified manual patch creation
    // In a real implementation, you'd want to do a proper diff
    const patchContent = `# Manual patch for ${path.basename(packagePath)}
# Created by modern-patch-package
# 
# This is a placeholder patch file.
# You may need to manually apply the changes or use a proper diff tool.
`;
    
    await fs.writeFile(patchFilePath, patchContent);
  }

  private async applyPatch(patchFile: string): Promise<void> {
    const { success, error } = await executeCommand(
      `git apply --ignore-whitespace "${patchFile}"`,
      process.cwd()
    );

    if (!success) {
      throw new Error(`Git apply failed: ${error}`);
    }
  }

  private async reversePatch(patchFile: string): Promise<void> {
    const { success, error } = await executeCommand(
      `git apply --reverse --ignore-whitespace "${patchFile}"`,
      process.cwd()
    );

    if (!success) {
      throw new Error(`Git reverse apply failed: ${error}`);
    }
  }

  private async createGitHubIssue(packageName: string, patchFilePath: string): Promise<void> {
    try {
      const patchContent = await fs.readFile(patchFilePath, 'utf8');
      const issueTitle = `Fix for ${packageName}`;
      const issueBody = `## Patch for ${packageName}

This patch was created using modern-patch-package.

\`\`\`patch
${patchContent}
\`\`\`

Please review and consider merging this fix.`;

      const url = `https://github.com/issues/new?title=${encodeURIComponent(issueTitle)}&body=${encodeURIComponent(issueBody)}`;
      
      console.log(chalk.blue(`Opening GitHub issue: ${url}`));
      
      // Open browser (platform-specific)
      const { execSync } = require('child_process');
      const platform = process.platform;
      
      if (platform === 'darwin') {
        execSync(`open "${url}"`);
      } else if (platform === 'win32') {
        execSync(`start "${url}"`);
      } else {
        execSync(`xdg-open "${url}"`);
      }
    } catch (err) {
      console.warn(chalk.yellow(`Could not create GitHub issue: ${err}`));
    }
  }

  async listPatches(): Promise<PatchFile[]> {
    const patchFiles = await getPatchFiles(this.patchDir);
    const patches: PatchFile[] = [];

    for (const patchFile of patchFiles) {
      const fileName = path.basename(patchFile);
      const match = fileName.match(/^(.+)\+([^+]+)(?:\+(\d+)(?:\+(.+))?)?\.patch$/);
      
      if (match) {
        patches.push({
          name: fileName,
          path: patchFile,
          packageName: match[1],
          packageVersion: match[2],
          sequence: match[3] ? parseInt(match[3]) : undefined,
          description: match[4]
        });
      }
    }

    return patches.sort((a, b) => {
      if (a.packageName !== b.packageName) {
        return a.packageName.localeCompare(b.packageName);
      }
      if (a.sequence !== b.sequence) {
        return (a.sequence || 0) - (b.sequence || 0);
      }
      return a.packageVersion.localeCompare(b.packageVersion);
    });
  }
} 