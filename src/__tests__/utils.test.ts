// Mock the detectPackageManager function
const mockDetectPackageManager = jest.fn();

// Mock fs-extra
jest.mock('fs-extra');

// Mock child_process
const mockExecSync = jest.fn();
jest.mock('child_process', () => ({
  execSync: mockExecSync,
}));

import * as utils from '../utils';
import fs from 'fs-extra';
import path from 'path';

// Only mock detectPackageManager for path-based tests
jest.mock('../utils', () => {
  const actual = jest.requireActual('../utils');
  return {
    ...actual,
    detectPackageManager: mockDetectPackageManager,
  };
});

describe('Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getPackageInfo', () => {
    it('should return package info when package.json exists', async () => {
      const mockPackageJson = {
        name: 'test-package',
        version: '1.0.0',
      };

      (fs.pathExists as jest.Mock).mockResolvedValue(true);
      (fs.readJson as jest.Mock).mockResolvedValue(mockPackageJson);

      const result = await utils.getPackageInfo('/path/to/package');

      expect(result).toEqual({
        name: 'test-package',
        version: '1.0.0',
        path: '/path/to/package',
      });
    });

    it('should return null when package.json does not exist', async () => {
      (fs.pathExists as jest.Mock).mockResolvedValue(false);

      const result = await utils.getPackageInfo('/path/to/package');

      expect(result).toBeNull();
    });
  });

  describe('findNodeModulesPath', () => {
    beforeEach(() => {
      // Mock process.cwd
      jest.spyOn(process, 'cwd').mockReturnValue('/mock/project');
    });

    it('should return node_modules for yarn 1.x', async () => {
      // Mock detectPackageManager to return yarn 1.x
      mockDetectPackageManager.mockResolvedValue({
        name: 'yarn',
        version: '1.22.19',
        lockFile: 'yarn.lock',
        hasLockFile: true,
      });

      const result = await utils.findNodeModulesPath();

      expect(result).toBe(path.join('/mock/project', 'node_modules'));
    });

    it('should return node_modules for yarn 2+ with nodeLinker: node-modules', async () => {
      // Mock detectPackageManager to return yarn 2+
      mockDetectPackageManager.mockResolvedValue({
        name: 'yarn',
        version: '2.4.3',
        lockFile: 'yarn.lock',
        hasLockFile: true,
      });

      // Mock fs.pathExists to return true for node_modules
      (fs.pathExists as jest.Mock).mockResolvedValueOnce(true);

      const result = await utils.findNodeModulesPath();

      expect(result).toBe(path.join('/mock/project', 'node_modules'));
    });

    it('should return node_modules for npm', async () => {
      // Mock detectPackageManager to return npm
      mockDetectPackageManager.mockResolvedValue({
        name: 'npm',
        version: '8.0.0',
        lockFile: 'package-lock.json',
        hasLockFile: true,
      });

      // Mock fs.pathExists to return true for node_modules
      (fs.pathExists as jest.Mock).mockResolvedValueOnce(true);

      const result = await utils.findNodeModulesPath();

      expect(result).toBe(path.join('/mock/project', 'node_modules'));
    });

    it('should fallback to node_modules when no other paths exist', async () => {
      // Mock detectPackageManager to return yarn 2+
      mockDetectPackageManager.mockResolvedValue({
        name: 'yarn',
        version: '3.6.0',
        lockFile: 'yarn.lock',
        hasLockFile: true,
      });

      // Mock fs.pathExists to return false for all paths
      (fs.pathExists as jest.Mock).mockResolvedValue(false);

      const result = await utils.findNodeModulesPath();

      expect(result).toBe(path.join('/mock/project', 'node_modules'));
    });
  });

  describe('getPackagePath', () => {
    beforeEach(() => {
      // Mock process.cwd
      jest.spyOn(process, 'cwd').mockReturnValue('/mock/project');
    });

    it('should return null when package is not found for npm', async () => {
      // Mock detectPackageManager to return npm
      mockDetectPackageManager.mockResolvedValue({
        name: 'npm',
        version: '8.0.0',
        lockFile: 'package-lock.json',
        hasLockFile: true,
      });

      // Mock fs.pathExists to return false for the package
      (fs.pathExists as jest.Mock).mockResolvedValueOnce(false);

      const result = await utils.getPackagePath('nonexistent-package');

      expect(result).toBeNull();
    });
  });

  describe('createPatchDirectory', () => {
    it('should create patch directory', async () => {
      await utils.createPatchDirectory('test-patches');

      expect(fs.ensureDir).toHaveBeenCalledWith('test-patches');
    });
  });

  describe('generatePatchFileName', () => {
    it('should generate basic patch file name', () => {
      const result = utils.generatePatchFileName('test-package', '1.0.0');

      expect(result).toBe('test-package+1.0.0.patch');
    });

    it('should generate patch file name with sequence', () => {
      const result = utils.generatePatchFileName(
        'test-package',
        '1.0.0',
        1,
        'fix-bug'
      );

      expect(result).toBe('test-package+1.0.0+001+fix-bug.patch');
    });

    it('should generate patch file name with sequence only', () => {
      const result = utils.generatePatchFileName('test-package', '1.0.0', 5);

      expect(result).toBe('test-package+1.0.0+005.patch');
    });
  });

  describe('shouldIncludeFile', () => {
    it('should include file when no filters are specified', async () => {
      const result = await utils.shouldIncludeFile('test.js');

      expect(result).toBe(true);
    });

    it('should exclude file when it matches exclude pattern', async () => {
      const result = await utils.shouldIncludeFile('test.js', undefined, [
        '*.js',
      ]);

      expect(result).toBe(false);
    });

    it('should include file when it matches include pattern', async () => {
      const result = await utils.shouldIncludeFile('test.js', ['*.js']);

      expect(result).toBe(true);
    });

    it('should exclude file when it does not match include pattern', async () => {
      const result = await utils.shouldIncludeFile('test.js', ['*.ts']);

      expect(result).toBe(false);
    });

    it('should be case insensitive by default', async () => {
      const result = await utils.shouldIncludeFile('TEST.JS', ['*.js']);

      expect(result).toBe(true);
    });

    it('should be case sensitive when specified', async () => {
      const result = await utils.shouldIncludeFile(
        'TEST.JS',
        ['*.js'],
        undefined,
        true
      );

      expect(result).toBe(false);
    });
  });
});
