import fs from 'fs-extra';
import path from 'path';
import { glob } from 'glob';
import { PackageManager, PackageInfo } from './types';

export async function detectPackageManager(): Promise<PackageManager> {
  const cwd = process.cwd();

  if (await fs.pathExists(path.join(cwd, 'yarn.lock'))) {
    const yarnVersion = await getYarnVersion();
    return {
      name: 'yarn',
      version: yarnVersion,
      lockFile: 'yarn.lock',
      hasLockFile: true,
    };
  }

  if (await fs.pathExists(path.join(cwd, 'pnpm-lock.yaml'))) {
    const pnpmVersion = await getPnpmVersion();
    return {
      name: 'pnpm',
      version: pnpmVersion,
      lockFile: 'pnpm-lock.yaml',
      hasLockFile: true,
    };
  }

  if (await fs.pathExists(path.join(cwd, 'package-lock.json'))) {
    return {
      name: 'npm',
      version: await getNpmVersion(),
      lockFile: 'package-lock.json',
      hasLockFile: true,
    };
  }

  return {
    name: 'npm',
    version: await getNpmVersion(),
    lockFile: 'package-lock.json',
    hasLockFile: false,
  };
}

async function getYarnVersion(): Promise<string> {
  try {
    const { execSync } = require('child_process');
    const version = execSync('yarn --version', { encoding: 'utf8' }).trim();
    return version;
  } catch {
    return 'unknown';
  }
}

async function getPnpmVersion(): Promise<string> {
  try {
    const { execSync } = require('child_process');
    const version = execSync('pnpm --version', { encoding: 'utf8' }).trim();
    return version;
  } catch {
    return 'unknown';
  }
}

async function getNpmVersion(): Promise<string> {
  try {
    const { execSync } = require('child_process');
    const version = execSync('npm --version', { encoding: 'utf8' }).trim();
    return version;
  } catch {
    return 'unknown';
  }
}

export async function getPackageInfo(
  packagePath: string
): Promise<PackageInfo | null> {
  try {
    const packageJsonPath = path.join(packagePath, 'package.json');
    if (!(await fs.pathExists(packageJsonPath))) {
      return null;
    }

    const packageJson = await fs.readJson(packageJsonPath);
    return {
      name: packageJson.name,
      version: packageJson.version,
      path: packagePath,
    };
  } catch {
    return null;
  }
}

export async function findNodeModulesPath(): Promise<string> {
  const cwd = process.cwd();

  // Check for Yarn first to determine the correct path structure
  const packageManager = await detectPackageManager();

  if (packageManager.name === 'yarn') {
    const yarnVersion = packageManager.version;

    // Yarn 1 (Classic) - uses node_modules
    if (yarnVersion.startsWith('1.')) {
      return path.join(cwd, 'node_modules');
    }

    // Yarn 2+ (Berry) - check for different cache structures
    const possibleYarnPaths = [
      path.join(cwd, 'node_modules'), // Yarn 2+ with nodeLinker: node-modules
      path.join(cwd, '.yarn', 'cache'), // Yarn 2+ with default cache
      path.join(cwd, '.yarn', 'unplugged'), // Yarn 2+ unplugged packages
    ];

    for (const possiblePath of possibleYarnPaths) {
      if (await fs.pathExists(possiblePath)) {
        return possiblePath;
      }
    }

    // Fallback for Yarn 2+ PnP mode - we need to find packages differently
    return path.join(cwd, 'node_modules');
  }

  // For npm and pnpm
  const possiblePaths = [
    path.join(cwd, 'node_modules'),
    path.join(cwd, '.pnpm'),
  ];

  for (const possiblePath of possiblePaths) {
    if (await fs.pathExists(possiblePath)) {
      return possiblePath;
    }
  }

  return path.join(cwd, 'node_modules');
}

export async function getPackagePath(
  packageName: string
): Promise<string | null> {
  const packageManager = await detectPackageManager();

  if (packageManager.name === 'yarn') {
    const yarnVersion = packageManager.version;

    // Yarn 1 (Classic) - standard node_modules structure
    if (yarnVersion.startsWith('1.')) {
      const packagePath = path.join(process.cwd(), 'node_modules', packageName);
      if (await fs.pathExists(packagePath)) {
        return packagePath;
      }
      return null;
    }

    // Yarn 2+ (Berry) - handle different modes
    const cwd = process.cwd();

    // Check nodeLinker: node-modules mode first
    const nodeModulesPath = path.join(cwd, 'node_modules', packageName);
    if (await fs.pathExists(nodeModulesPath)) {
      return nodeModulesPath;
    }

    // Check .yarn/cache for cached packages
    const cachePath = path.join(cwd, '.yarn', 'cache', packageName);
    if (await fs.pathExists(cachePath)) {
      return cachePath;
    }

    // Check .yarn/unplugged for unplugged packages
    const unpluggedPath = path.join(cwd, '.yarn', 'unplugged', packageName);
    if (await fs.pathExists(unpluggedPath)) {
      return unpluggedPath;
    }

    // For PnP mode, we need to check the .pnp.cjs file or use yarn info
    // This is a simplified approach - in practice, you might need more sophisticated PnP handling
    try {
      const { execSync } = require('child_process');
      const yarnInfo = execSync(`yarn info ${packageName} --json`, {
        encoding: 'utf8',
      });
      const info = JSON.parse(yarnInfo);
      if (info.data && info.data.location) {
        return info.data.location;
      }
    } catch {
      // If yarn info fails, try to find in node_modules as fallback
      const fallbackPath = path.join(cwd, 'node_modules', packageName);
      if (await fs.pathExists(fallbackPath)) {
        return fallbackPath;
      }
    }

    return null;
  }

  // For npm and pnpm - standard approach
  const nodeModulesPath = await findNodeModulesPath();
  const packagePath = path.join(nodeModulesPath, packageName);

  if (await fs.pathExists(packagePath)) {
    return packagePath;
  }

  return null;
}

export async function createPatchDirectory(
  patchDir: string = 'patches'
): Promise<void> {
  await fs.ensureDir(patchDir);
}

export async function getPatchFiles(
  patchDir: string = 'patches'
): Promise<string[]> {
  if (!(await fs.pathExists(patchDir))) {
    return [];
  }

  const pattern = path.join(patchDir, '*.patch');
  return await glob(pattern);
}

export async function shouldIncludeFile(
  filePath: string,
  include?: string[],
  exclude?: string[],
  caseSensitive: boolean = false
): Promise<boolean> {
  const flags = caseSensitive ? '' : 'i';

  // Helper to convert glob to regex string
  function globToRegExp(pattern: string): string {
    // Escape regex special chars except *
    let regex = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    // Replace * with .*
    regex = regex.replace(/\*/g, '.*');
    return `^${regex}$`;
  }

  // Check exclude patterns first
  if (exclude && exclude.length > 0) {
    for (const pattern of exclude) {
      const regex = new RegExp(globToRegExp(pattern), flags);
      if (regex.test(filePath)) {
        return false;
      }
    }
  }

  // Check include patterns
  if (include && include.length > 0) {
    for (const pattern of include) {
      const regex = new RegExp(globToRegExp(pattern), flags);
      if (regex.test(filePath)) {
        return true;
      }
    }
    return false;
  }

  return true;
}

export function generatePatchFileName(
  packageName: string,
  packageVersion: string,
  sequence?: number,
  description?: string
): string {
  let fileName = `${packageName}+${packageVersion}`;

  if (sequence !== undefined) {
    const sequenceStr = sequence.toString().padStart(3, '0');
    fileName += `+${sequenceStr}`;

    if (description) {
      fileName += `+${description}`;
    }
  }

  return `${fileName}.patch`;
}

export async function executeCommand(
  command: string,
  cwd?: string
): Promise<{ success: boolean; output: string; error: string }> {
  return new Promise(resolve => {
    const { spawn } = require('child_process');
    const [cmd, ...args] = command.split(' ');

    const child = spawn(cmd, args, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
    });

    let output = '';
    let error = '';

    child.stdout?.on('data', (data: Buffer) => {
      output += data.toString();
    });

    child.stderr?.on('data', (data: Buffer) => {
      error += data.toString();
    });

    child.on('close', (code: number) => {
      resolve({
        success: code === 0,
        output,
        error,
      });
    });
  });
}
