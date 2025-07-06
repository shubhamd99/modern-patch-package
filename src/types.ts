export interface PackageInfo {
  name: string;
  version: string;
  path: string;
}

export interface PatchOptions {
  packageName?: string;
  patchDir?: string;
  exclude?: string[];
  include?: string[];
  caseSensitive?: boolean;
  errorOnFail?: boolean;
  reverse?: boolean;
  append?: string;
  rebase?: string;
  partial?: boolean;
  createIssue?: boolean;
  useYarn?: boolean;
}

export interface PatchResult {
  success: boolean;
  patchesCreated: string[];
  patchesApplied: string[];
  errors: string[];
}

export interface PackageManager {
  name: 'npm' | 'yarn' | 'pnpm';
  version: string;
  lockFile: string;
  hasLockFile: boolean;
}

export interface PatchFile {
  name: string;
  path: string;
  packageName: string;
  packageVersion: string;
  sequence?: number;
  description?: string;
} 