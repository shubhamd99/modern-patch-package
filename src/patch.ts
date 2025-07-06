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
  detectPackageManager,
} from './utils';
import { PatchOptions, PatchResult, PatchFile, PackageInfo } from './types';

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
      errors: [],
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

      console.log(
        chalk.green(`Found package: ${packageInfo.name}@${packageInfo.version}`)
      );

      // Create patch directory
      await createPatchDirectory(this.patchDir);

      // Generate patch file name
      const patchFileName = generatePatchFileName(
        packageInfo.name,
        packageInfo.version,
        this.options.append ? 1 : undefined,
        this.options.append
      );
      const patchFilePath = path.join(this.patchDir, patchFileName);

      // Check if this is a git repository to get the original version
      const { success: isGitRepo } = await executeCommand(
        'git rev-parse --git-dir',
        process.cwd()
      );

      if (isGitRepo) {
        // Try to get the original version from git
        const { success: hasOriginal, output: originalPath } =
          await executeCommand(
            `git ls-files --full-name "${packagePath}"`,
            process.cwd()
          );

        if (hasOriginal && originalPath.trim()) {
          // Create patch using git diff with the original version
          const { success, output, error } = await executeCommand(
            `git diff HEAD~1 -- "${packagePath}"`,
            process.cwd()
          );

          if (success && output.trim()) {
            await fs.writeFile(patchFilePath, output);
            result.patchesCreated.push(patchFilePath);
            result.success = true;
            console.log(chalk.green(`✓ Patch created: ${patchFileName}`));
          } else {
            console.warn(
              chalk.yellow(
                'No changes detected in git history, creating manual patch'
              )
            );
            await this.createManualPatch(packagePath, patchFilePath);
            result.patchesCreated.push(patchFilePath);
            result.success = true;
          }
        } else {
          // Package not tracked in git, create manual patch
          console.warn(
            chalk.yellow('Package not tracked in git, creating manual patch')
          );
          await this.createManualPatch(packagePath, patchFilePath);
          result.patchesCreated.push(patchFilePath);
          result.success = true;
        }
      } else {
        // Not a git repository, create manual patch
        console.warn(
          chalk.yellow('Not a git repository, creating manual patch')
        );
        await this.createManualPatch(packagePath, patchFilePath);
        result.patchesCreated.push(patchFilePath);
        result.success = true;
      }

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
      errors: [],
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
        console.log(
          chalk.green(
            `✓ Applied ${result.patchesApplied.length} patches successfully`
          )
        );
      } else {
        console.log(
          chalk.red(`✗ Failed to apply ${result.errors.length} patches`)
        );
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
      errors: [],
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
        console.log(
          chalk.green(
            `✓ Reversed ${result.patchesApplied.length} patches successfully`
          )
        );
      } else {
        console.log(
          chalk.red(`✗ Failed to reverse ${result.errors.length} patches`)
        );
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
    patchFilePath: string
  ): Promise<void> {
    // Try to create a real patch by downloading the original package
    const packageInfo = await getPackageInfo(packagePath);
    if (packageInfo) {
      const success = await this.createPatchFromRegistry(
        packageInfo,
        packagePath,
        patchFilePath
      );
      if (success) {
        return;
      }
    }

    // Fallback to manual patch if registry approach fails
    const packageName = path.basename(packagePath);
    const version = packageInfo?.version || 'unknown';

    const patchContent = `# Manual patch for ${packageName}@${version}
# Created by modern-patch-package
# 
# This patch was created manually because:
# - The package is not tracked in git, or
# - No changes were detected in git history, or
# - Git diff failed, or
# - Could not download original package from registry
#
# To apply this patch manually:
# 1. Navigate to the package directory: ${packagePath}
# 2. Apply the changes manually based on your modifications
# 3. Test the changes to ensure they work as expected
#
# Note: This is a placeholder patch file. You may need to manually apply
# the changes or use a proper diff tool to create a real patch.
#
# Original package location: ${packagePath}
# Patch created at: ${new Date().toISOString()}
`;

    await fs.writeFile(patchFilePath, patchContent);
  }

  private async createPatchFromRegistry(
    packageInfo: PackageInfo,
    packagePath: string,
    patchFilePath: string
  ): Promise<boolean> {
    try {
      console.log(
        chalk.blue(
          `Attempting to download original package ${packageInfo.name}@${packageInfo.version} from registry...`
        )
      );

      // Create a temporary directory for the original package
      const tempDir = path.join(this.patchDir, 'temp-original');
      await fs.ensureDir(tempDir);

      // Download the original package
      const { success: downloadSuccess } = await executeCommand(
        `npm pack ${packageInfo.name}@${packageInfo.version} --pack-destination "${tempDir}"`,
        process.cwd()
      );

      if (!downloadSuccess) {
        console.warn(
          chalk.yellow('Failed to download original package from registry')
        );
        await fs.remove(tempDir);
        return false;
      }

      // Find the downloaded tarball
      const files = await fs.readdir(tempDir);
      const tarball = files.find(file => file.endsWith('.tgz'));

      if (!tarball) {
        console.warn(chalk.yellow('No tarball found after download'));
        await fs.remove(tempDir);
        return false;
      }

      // Extract the tarball
      const tarballPath = path.join(tempDir, tarball);
      const extractPath = path.join(tempDir, 'extracted');
      await fs.ensureDir(extractPath);

      const { success: extractSuccess } = await executeCommand(
        `tar -xzf "${tarballPath}" -C "${extractPath}"`,
        process.cwd()
      );

      if (!extractSuccess) {
        console.warn(chalk.yellow('Failed to extract tarball'));
        await fs.remove(tempDir);
        return false;
      }

      // Check if the extracted directory contains a 'package' subdirectory
      let originalDir = extractPath;
      const packageSubdir = path.join(extractPath, 'package');
      if (await fs.pathExists(packageSubdir)) {
        originalDir = packageSubdir;
      }

      // Debug: print the directories and file lists
      const getAllFiles = async (
        dir: string,
        prefix = ''
      ): Promise<string[]> => {
        let results: string[] = [];
        const list = await fs.readdir(dir);
        for (const file of list) {
          const filePath = path.join(dir, file);
          const relPath = path.join(prefix, file);
          const stat = await fs.stat(filePath);
          if (stat && stat.isDirectory()) {
            results = results.concat(await getAllFiles(filePath, relPath));
          } else {
            results.push(relPath);
          }
        }
        return results;
      };
      const originalFiles = await getAllFiles(originalDir);
      const modifiedFiles = await getAllFiles(packagePath);
      console.log(
        chalk.cyan('--- Original (extracted) directory:'),
        originalDir
      );
      console.log(chalk.cyan('Files:'), originalFiles);
      console.log(
        chalk.magenta('--- Modified (node_modules) directory:'),
        packagePath
      );
      console.log(chalk.magenta('Files:'), modifiedFiles);

      // Create a more robust diff by comparing individual files
      let hasDifferences = false;
      const patchContent: string[] = [];
      patchContent.push(
        `diff --git a/${packageInfo.name} b/${packageInfo.name}`
      );
      patchContent.push(`index 0000000..0000000 100644`);
      patchContent.push(`--- a/${packageInfo.name}`);
      patchContent.push(`+++ b/${packageInfo.name}`);

      // Find common files to compare
      const commonFiles = originalFiles.filter(file =>
        modifiedFiles.includes(file)
      );
      console.log(chalk.blue('Common files to compare:'), commonFiles);

      for (const file of commonFiles) {
        const originalFilePath = path.join(originalDir, file);
        const modifiedFilePath = path.join(packagePath, file);

        try {
          const originalContent = await fs.readFile(originalFilePath, 'utf8');
          const modifiedContent = await fs.readFile(modifiedFilePath, 'utf8');

          if (originalContent !== modifiedContent) {
            hasDifferences = true;
            console.log(chalk.green(`Found differences in: ${file}`));

            // Create a simple diff for this file
            const originalLines = originalContent.split('\n');
            const modifiedLines = modifiedContent.split('\n');

            patchContent.push(
              `@@ -1,${originalLines.length} +1,${modifiedLines.length} @@`
            );

            // Simple line-by-line comparison (this is a basic implementation)
            const maxLines = Math.max(
              originalLines.length,
              modifiedLines.length
            );
            for (let i = 0; i < maxLines; i++) {
              const originalLine = originalLines[i] || '';
              const modifiedLine = modifiedLines[i] || '';

              if (originalLine !== modifiedLine) {
                if (originalLine) patchContent.push(`-${originalLine}`);
                if (modifiedLine) patchContent.push(`+${modifiedLine}`);
              } else {
                patchContent.push(` ${originalLine}`);
              }
            }
          }
        } catch (err) {
          console.warn(chalk.yellow(`Could not compare file ${file}: ${err}`));
        }
      }

      // Do NOT clean up temp directory so user can inspect it
      // await fs.remove(tempDir);

      if (hasDifferences) {
        const finalPatchContent = patchContent.join('\n');
        await fs.writeFile(patchFilePath, finalPatchContent);
        console.log(
          chalk.green('✓ Created patch by comparing individual files')
        );
        return true;
      } else {
        console.warn(
          chalk.yellow(
            'No differences found between original and current package'
          )
        );
        return false;
      }
    } catch (err) {
      console.warn(chalk.yellow(`Error creating patch from registry: ${err}`));
      return false;
    }
  }

  private async applyPatch(patchFile: string): Promise<void> {
    // Check if this is a manual patch (contains placeholder content)
    const patchContent = await fs.readFile(patchFile, 'utf8');
    const isManualPatch =
      patchContent.includes('# Manual patch for') &&
      patchContent.includes('# Created by modern-patch-package');

    if (isManualPatch) {
      console.warn(
        chalk.yellow(`Skipping manual patch: ${path.basename(patchFile)}`)
      );
      console.warn(
        chalk.yellow(
          'Manual patches need to be applied manually. Check the patch file for instructions.'
        )
      );
      return;
    }

    // Check if this is a custom patch (created by our file comparison)
    const isCustomPatch =
      patchContent.includes('diff --git a/') &&
      patchContent.includes('index 0000000..0000000');

    if (isCustomPatch) {
      console.log(
        chalk.blue(`Applying custom patch: ${path.basename(patchFile)}`)
      );
      await this.applyCustomPatch(patchContent);
      return;
    }

    // Try to apply as a git patch
    const { success, error } = await executeCommand(
      `git apply --ignore-whitespace "${patchFile}"`,
      process.cwd()
    );

    if (!success) {
      // If git apply fails, try with more lenient options
      const { success: retrySuccess, error: retryError } = await executeCommand(
        `git apply --ignore-whitespace --reject "${patchFile}"`,
        process.cwd()
      );

      if (!retrySuccess) {
        throw new Error(
          `Git apply failed: ${error}\nRetry also failed: ${retryError}`
        );
      } else {
        console.warn(
          chalk.yellow(
            `Applied patch with rejections: ${path.basename(patchFile)}`
          )
        );
        console.warn(
          chalk.yellow(
            'Some parts of the patch could not be applied automatically.'
          )
        );
        console.warn(
          chalk.yellow(
            'Check for .rej files and apply changes manually if needed.'
          )
        );
      }
    }
  }

  private async applyCustomPatch(patchContent: string): Promise<void> {
    const lines = patchContent.split('\n');
    let currentFile = '';
    let inHunk = false;
    let lineNumber = 0;
    let fileContent: string[] = [];

    for (const line of lines) {
      if (line.startsWith('diff --git a/')) {
        // Extract package name from diff header
        const match = line.match(/diff --git a\/([^\/]+)/);
        if (match) {
          currentFile = match[1];
          console.log(chalk.blue(`Processing file: ${currentFile}`));
        }
      } else if (line.startsWith('@@')) {
        inHunk = true;
        lineNumber = 0;
        fileContent = [];
      } else if (inHunk && line.startsWith(' ')) {
        // Unchanged line
        fileContent.push(line.substring(1));
        lineNumber++;
      } else if (inHunk && line.startsWith('+')) {
        // Added line
        fileContent.push(line.substring(1));
        lineNumber++;
      } else if (inHunk && line.startsWith('-')) {
        // Removed line - skip it
        lineNumber++;
      } else if (inHunk && !line.startsWith('@@')) {
        // End of hunk or other content
        inHunk = false;

        // Apply the changes to the file
        if (currentFile && fileContent.length > 0) {
          const packagePath = await getPackagePath(currentFile);
          if (packagePath) {
            // Find the main file to modify (usually index.js or the main entry point)
            const packageJsonPath = path.join(packagePath, 'package.json');
            if (await fs.pathExists(packageJsonPath)) {
              const packageJson = await fs.readJson(packageJsonPath);
              const mainFile = packageJson.main || 'index.js';
              const mainFilePath = path.join(packagePath, mainFile);

              if (await fs.pathExists(mainFilePath)) {
                await fs.writeFile(mainFilePath, fileContent.join('\n'));
                console.log(chalk.green(`✓ Applied changes to ${mainFile}`));
              }
            }
          }
        }
      }
    }
  }

  private async reversePatch(patchFile: string): Promise<void> {
    // Check if this is a manual patch (contains placeholder content)
    const patchContent = await fs.readFile(patchFile, 'utf8');
    const isManualPatch =
      patchContent.includes('# Manual patch for') &&
      patchContent.includes('# Created by modern-patch-package');

    if (isManualPatch) {
      console.warn(
        chalk.yellow(`Cannot reverse manual patch: ${path.basename(patchFile)}`)
      );
      console.warn(
        chalk.yellow('Manual patches need to be reversed manually.')
      );
      return;
    }

    // Try to reverse as a git patch
    const { success, error } = await executeCommand(
      `git apply --reverse --ignore-whitespace "${patchFile}"`,
      process.cwd()
    );

    if (!success) {
      throw new Error(`Git reverse apply failed: ${error}`);
    }
  }

  private async createGitHubIssue(
    packageName: string,
    patchFilePath: string
  ): Promise<void> {
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
      const match = fileName.match(
        /^(.+)\+([^+]+)(?:\+(\d+)(?:\+(.+))?)?\.patch$/
      );

      if (match) {
        patches.push({
          name: fileName,
          path: patchFile,
          packageName: match[1],
          packageVersion: match[2],
          sequence: match[3] ? parseInt(match[3]) : undefined,
          description: match[4],
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
