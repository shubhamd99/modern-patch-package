import { detectPackageManager } from '../utils';
import fs from 'fs-extra';
import path from 'path';

// Mock fs-extra
jest.mock('fs-extra');

// Mock child_process
const mockExecSync = jest.fn();
jest.mock('child_process', () => ({
  execSync: mockExecSync,
}));

describe('detectPackageManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should detect npm when package-lock.json exists', async () => {
    // Mock path.join to return the expected paths
    const originalPathJoin = path.join;
    path.join = jest.fn((...args) => {
      if (args.includes('package-lock.json')) {
        return '/mock/path/package-lock.json';
      }
      if (args.includes('yarn.lock')) {
        return '/mock/path/yarn.lock';
      }
      if (args.includes('pnpm-lock.yaml')) {
        return '/mock/path/pnpm-lock.yaml';
      }
      return originalPathJoin(...args);
    });

    // Mock fs.pathExists to return false for yarn.lock and pnpm-lock.yaml, true for package-lock.json
    (fs.pathExists as jest.Mock)
      .mockResolvedValueOnce(false) // yarn.lock
      .mockResolvedValueOnce(false) // pnpm-lock.yaml
      .mockResolvedValueOnce(true); // package-lock.json

    mockExecSync.mockReturnValue('8.0.0');

    const result = await detectPackageManager();

    expect(result.name).toBe('npm');
    expect(result.version).toBe('8.0.0');
    expect(result.lockFile).toBe('package-lock.json');
    expect(result.hasLockFile).toBe(true);

    // Restore path.join
    path.join = originalPathJoin;
  });

  it('should detect yarn when yarn.lock exists', async () => {
    // Mock path.join to return the expected paths
    const originalPathJoin = path.join;
    path.join = jest.fn((...args) => {
      if (args.includes('package-lock.json')) {
        return '/mock/path/package-lock.json';
      }
      if (args.includes('yarn.lock')) {
        return '/mock/path/yarn.lock';
      }
      if (args.includes('pnpm-lock.yaml')) {
        return '/mock/path/pnpm-lock.yaml';
      }
      return originalPathJoin(...args);
    });

    // Mock fs.pathExists to return true for yarn.lock (first check)
    (fs.pathExists as jest.Mock).mockResolvedValueOnce(true); // yarn.lock

    mockExecSync.mockReturnValue('3.6.0');

    const result = await detectPackageManager();

    expect(result.name).toBe('yarn');
    expect(result.version).toBe('3.6.0');
    expect(result.lockFile).toBe('yarn.lock');
    expect(result.hasLockFile).toBe(true);

    // Restore path.join
    path.join = originalPathJoin;
  });

  it('should detect yarn 1.x (classic) when yarn.lock exists', async () => {
    // Mock path.join to return the expected paths
    const originalPathJoin = path.join;
    path.join = jest.fn((...args) => {
      if (args.includes('package-lock.json')) {
        return '/mock/path/package-lock.json';
      }
      if (args.includes('yarn.lock')) {
        return '/mock/path/yarn.lock';
      }
      if (args.includes('pnpm-lock.yaml')) {
        return '/mock/path/pnpm-lock.yaml';
      }
      return originalPathJoin(...args);
    });

    // Mock fs.pathExists to return true for yarn.lock (first check)
    (fs.pathExists as jest.Mock).mockResolvedValueOnce(true); // yarn.lock

    mockExecSync.mockReturnValue('1.22.19');

    const result = await detectPackageManager();

    expect(result.name).toBe('yarn');
    expect(result.version).toBe('1.22.19');
    expect(result.lockFile).toBe('yarn.lock');
    expect(result.hasLockFile).toBe(true);

    // Restore path.join
    path.join = originalPathJoin;
  });

  it('should detect yarn 2.x (berry) when yarn.lock exists', async () => {
    // Mock path.join to return the expected paths
    const originalPathJoin = path.join;
    path.join = jest.fn((...args) => {
      if (args.includes('package-lock.json')) {
        return '/mock/path/package-lock.json';
      }
      if (args.includes('yarn.lock')) {
        return '/mock/path/yarn.lock';
      }
      if (args.includes('pnpm-lock.yaml')) {
        return '/mock/path/pnpm-lock.yaml';
      }
      return originalPathJoin(...args);
    });

    // Mock fs.pathExists to return true for yarn.lock (first check)
    (fs.pathExists as jest.Mock).mockResolvedValueOnce(true); // yarn.lock

    mockExecSync.mockReturnValue('2.4.3');

    const result = await detectPackageManager();

    expect(result.name).toBe('yarn');
    expect(result.version).toBe('2.4.3');
    expect(result.lockFile).toBe('yarn.lock');
    expect(result.hasLockFile).toBe(true);

    // Restore path.join
    path.join = originalPathJoin;
  });

  it('should detect yarn 4.x when yarn.lock exists', async () => {
    // Mock path.join to return the expected paths
    const originalPathJoin = path.join;
    path.join = jest.fn((...args) => {
      if (args.includes('package-lock.json')) {
        return '/mock/path/package-lock.json';
      }
      if (args.includes('yarn.lock')) {
        return '/mock/path/yarn.lock';
      }
      if (args.includes('pnpm-lock.yaml')) {
        return '/mock/path/pnpm-lock.yaml';
      }
      return originalPathJoin(...args);
    });

    // Mock fs.pathExists to return true for yarn.lock (first check)
    (fs.pathExists as jest.Mock).mockResolvedValueOnce(true); // yarn.lock

    mockExecSync.mockReturnValue('4.0.2');

    const result = await detectPackageManager();

    expect(result.name).toBe('yarn');
    expect(result.version).toBe('4.0.2');
    expect(result.lockFile).toBe('yarn.lock');
    expect(result.hasLockFile).toBe(true);

    // Restore path.join
    path.join = originalPathJoin;
  });

  it('should detect pnpm when pnpm-lock.yaml exists', async () => {
    // Mock path.join to return the expected paths
    const originalPathJoin = path.join;
    path.join = jest.fn((...args) => {
      if (args.includes('package-lock.json')) {
        return '/mock/path/package-lock.json';
      }
      if (args.includes('yarn.lock')) {
        return '/mock/path/yarn.lock';
      }
      if (args.includes('pnpm-lock.yaml')) {
        return '/mock/path/pnpm-lock.yaml';
      }
      return originalPathJoin(...args);
    });

    // Mock fs.pathExists to return false for yarn.lock, true for pnpm-lock.yaml
    (fs.pathExists as jest.Mock)
      .mockResolvedValueOnce(false) // yarn.lock
      .mockResolvedValueOnce(true); // pnpm-lock.yaml

    mockExecSync.mockReturnValue('8.0.0');

    const result = await detectPackageManager();

    expect(result.name).toBe('pnpm');
    expect(result.version).toBe('8.0.0');
    expect(result.lockFile).toBe('pnpm-lock.yaml');
    expect(result.hasLockFile).toBe(true);

    // Restore path.join
    path.join = originalPathJoin;
  });
});
