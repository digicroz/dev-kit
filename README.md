# 🚀 Development Kit (DK)

> A comprehensive CLI toolkit for modern development workflows - featuring task automation, project cleaning, and developer utilities built with TypeScript.

[![npm version](https://img.shields.io/npm/v/@digicroz/dev-kit.svg)](https://www.npmjs.com/package/@digicroz/dev-kit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub stars](https://img.shields.io/github/stars/digicroz/dev-kit.svg)](https://github.com/digicroz/dev-kit/stargazers)
[![GitHub issues](https://img.shields.io/github/issues/digicroz/dev-kit.svg)](https://github.com/digicroz/dev-kit/issues)

## ✨ Features

- 🧹 **Project Cleanup** - Clean temporary files and build artifacts
- 🚀 **Smart Deployment** - Automated deployment workflows with version management
- 🩺 **Health Diagnostics** - System and environment health checks
- ⚡ **Fast & Modern** - Built with TypeScript and optimized for performance
- 🎨 **Beautiful UI** - Rich terminal interface with colors and animations

## 📦 Quick Start

### Option 1: Global Installation (Recommended)

```bash
npm install -g @digicroz/dev-kit
```

After global installation, use `dk` directly from anywhere:

```bash
dk --help
dk doctor
dk clean
```

### Option 2: Local Project Usage

```bash
# Install locally
npm install @digicroz/dev-kit

# Use with npx
npx dk --help
npx dk clean
```

### Option 3: Development Setup

```bash
# Clone and setup for development
git clone https://github.com/digicroz/dev-kit.git
cd dev-kit
npm install
npm run build

# Install globally from source
npm install -g .
```

## 🎯 Quick Commands

Once installed globally, here are the most common commands:

```bash
# Check system health and DK installation
dk doctor

# Clean your project
dk clean

# Deploy to development
dk deploy dev

# Deploy to production (with version management)
dk deploy prod

# Get help
dk --help
```

## 📖 Detailed Usage

### 🧹 `dk clean`

Clean temporary folders and files from your project.

**What it cleans:**

- `node_modules/` directories
- Build artifacts (`dist/`, `build/`)
- Temporary files and caches
- Log files

**Usage:**

```bash
dk clean
```

### 🚀 `dk deploy`

Deployment commands with smart workflows and version management.

#### Deploy to Development

```bash
dk deploy dev
```

- Pushes main branch to dev branch with force
- Quick and simple development deployment

#### Deploy to Production

```bash
dk deploy prod
```

**Comprehensive production workflow:**

- ✅ Pulls latest changes from stable branch
- ✅ Checks for uncommitted changes
- ✅ Ensures you're on the main branch
- ✅ Auto-increments version if needed
- ✅ Creates deployment commit with timestamp
- ✅ Pushes changes to main branch
- ✅ Creates pull request from main to stable
- ✅ Opens PR in browser

### 🩺 `dk doctor`

Run comprehensive system and environment diagnostics.

**Checks:**

- DK installation status
- Node.js and npm compatibility
- Git availability and repository status
- Available DK commands
- Current project status

**Usage:**

```bash
dk doctor
```

## ⚙️ Configuration

### Deployment Tracking

DK uses a `deploy.json` file to track deployment history and manage versions:

```json
{
  "last_deploy": "2025-07-05 14:30:00",
  "hash": "abc123def456",
  "version": "1.2.3"
}
```

This file is automatically created and updated during production deployments.

## 🔧 Prerequisites for Production Deployment

Before using `dk deploy prod`, ensure you have:

1. **✅ Git Repository**
   - Must be a git repository
   - Requires `main` and `stable` branches

2. **✅ GitHub CLI**

   ```bash
   # Install GitHub CLI
   npm install -g @github/cli

   # Authenticate
   gh auth login
   ```

3. **✅ Clean Working Directory**
   - No uncommitted changes
   - All changes should be committed

4. **✅ Correct Branch**
   - Must be on `main` branch for production deployment

## 🛠️ Development

### Building the Project

```bash
npm run build      # Build once
npm run dev        # Build and watch for changes
```

### Available Scripts

```bash
npm run build           # Build the project
npm run dev             # Build and watch for changes
npm run clean           # Clean build artifacts
npm run deploy:dev      # Alias for 'dk deploy dev'
npm run deploy:prod     # Alias for 'dk deploy prod'
```

## 🐛 Troubleshooting

### Common Issues

**1. `dk: command not found`**

```bash
# Reinstall globally
npm install -g @digicroz/dev-kit

# Or check if npm global bin is in PATH
npm config get prefix
```

**2. Permission errors on Windows**

```bash
# Run PowerShell as Administrator, then:
npm install -g @digicroz/dev-kit
```

**3. Deploy command fails**

```bash
# Check prerequisites
dk doctor

# Ensure GitHub CLI is authenticated
gh auth status
```

### Getting Help

```bash
# Show help
dk --help

# Run diagnostics
dk doctor

# Check version
dk --version
```

**Need more help?**

- 📖 [Read the full documentation](https://github.com/digicroz/dev-kit#readme)
- 🐛 [Report a bug](https://github.com/digicroz/dev-kit/issues/new)
- 💡 [Request a feature](https://github.com/digicroz/dev-kit/issues/new)
- 💬 [Join discussions](https://github.com/digicroz/dev-kit/discussions)

## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. **Fork the repository**
2. **Clone your fork**
   ```bash
   git clone https://github.com/your-username/dev-kit.git
   cd dev-kit
   ```
3. **Install dependencies**
   ```bash
   npm install
   ```
4. **Make your changes**
5. **Build and test**
   ```bash
   npm run build
   npm install -g .  # Install your changes globally
   dk doctor        # Test the installation
   ```
6. **Submit a pull request**

### Development Guidelines

- Use TypeScript for all new code
- Follow the existing code style
- Add tests for new features
- Update documentation as needed

## 📄 License

MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [TypeScript](https://www.typescriptlang.org/)
- CLI framework powered by [Commander.js](https://github.com/tj/commander.js/)
- Beautiful terminal UI with [Boxen](https://github.com/sindresorhus/boxen) and [Chalk](https://github.com/chalk/chalk)

---

<div align="center">

**Made with ❤️ for developers who love beautiful and efficient tools**

[Report Bug](https://github.com/digicroz/dev-kit/issues) • [Request Feature](https://github.com/digicroz/dev-kit/issues) • [Documentation](https://github.com/digicroz/dev-kit#readme)

</div>
