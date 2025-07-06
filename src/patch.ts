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

      // Create git diff between original and current
      const { success, output, error } = await executeCommand(
        `git diff --no-index "${originalDir}" "${packagePath}"`,
        process.cwd()
      );

      // Clean up temp directory
      await fs.remove(tempDir);

      if (success && output.trim()) {
        await fs.writeFile(patchFilePath, output);
        console.log(
          chalk.green(
            '✓ Created patch by comparing with original package from registry'
          )
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
