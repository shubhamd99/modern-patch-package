# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial release of modern-patch-package
- Support for Yarn (all versions: 1.x, 2.x, 3.x, 4.x), pnpm, and npm
- Intelligent Yarn version detection and compatibility
- Support for Yarn 2+ PnP mode and different cache structures
- CLI interface with comprehensive commands
- Programmatic API for integration
- Git-based patch creation and application
- Sequenced patches support
- GitHub issue creation integration
- File filtering with include/exclude patterns
- Package manager auto-detection
- TypeScript support with full type definitions
- Comprehensive test suite
- GitHub Actions CI/CD pipeline

### Features

- `create` command to generate patches from modified node_modules
- `apply` command to apply all patches in a project
- `list` command to show all available patches
- `info` command to display project information
- `--reverse` option to undo patches
- `--create-issue` option to open GitHub issues
- `--append` option for sequenced patches
- `--patch-dir` option for custom patch directories
- `--include` and `--exclude` options for file filtering
- `--error-on-fail` option for CI environments

### Technical

- Built with TypeScript for type safety
- Modern ES2020+ JavaScript features
- Comprehensive error handling and logging
- Cross-platform compatibility (Windows, macOS, Linux)
- Minimal dependencies for reliability
- Full test coverage with Jest
- ESLint and Prettier for code quality
- Automated CI/CD with GitHub Actions

## [1.0.0] - 2024-01-01

### Added

- Initial release
- Core patch functionality
- CLI interface
- TypeScript support
- Comprehensive documentation
