export { ModernPatchPackage } from './patch';
export type {
  PatchOptions,
  PatchResult,
  PackageInfo,
  PackageManager,
  PatchFile
} from './types';
export {
  detectPackageManager,
  getPackageInfo,
  getPackagePath,
  createPatchDirectory,
  getPatchFiles,
  shouldIncludeFile,
  generatePatchFileName,
  executeCommand
} from './utils';

// Default export for convenience
import { ModernPatchPackage } from './patch';
export default ModernPatchPackage; 