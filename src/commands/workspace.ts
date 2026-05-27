// Workspace command implementation
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { existsSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ui } from '../utils/ui-helpers.js';
import {
  getWorkspaceConfigPath,
  workspaceConfigExists,
  initWorkspaceConfig,
  readWorkspaceConfig,
  writeWorkspaceConfig,
  importWorkspaceConfig,
} from '../utils/workspace-config.js';
import type { Workspace, WorkspaceModule, WorkspaceAction } from '../types/workspace.js';

const execAsync = promisify(exec);
type ChalkColor = 'red' | 'green' | 'blue' | 'yellow' | 'cyan' | 'magenta' | 'gray';

// Initialize workspace configuration
export async function workspaceInit() {
  console.log(chalk.cyan('\n🚀 Workspace Configuration Initialization\n'));

  const configExists = workspaceConfigExists();

  if (configExists) {
    const { action } = await inquirer.prompt({
      type: 'list',
      name: 'action',
      message: 'Workspace config already exists. What would you like to do?',
      choices: [
        { name: 'Use existing config', value: 'use' },
        { name: 'Create new config (overwrites existing)', value: 'new' },
        { name: 'Import from another location', value: 'import' },
        { name: 'Cancel', value: 'cancel' },
      ],
    });

    if (action === 'cancel') {
      ui.info('Operation cancelled');
      return;
    }

    if (action === 'new') {
      const { confirm } = await inquirer.prompt({
        type: 'confirm',
        name: 'confirm',
        message: chalk.yellow('⚠️  This will overwrite your existing config. Continue?'),
        default: false,
      });

      if (!confirm) {
        ui.info('Operation cancelled');
        return;
      }
      initWorkspaceConfig();
      ui.success('New workspace config created', `Location: ${getWorkspaceConfigPath()}`);
    } else if (action === 'import') {
      const { filePath } = await inquirer.prompt({
        type: 'input',
        name: 'filePath',
        message: 'Enter the path to the workspace config file:',
        validate: (input) => {
          if (!input) return 'Path is required';
          if (!existsSync(input)) return 'File does not exist';
          return true;
        },
      });

      try {
        const importedConfig = importWorkspaceConfig(filePath);
        writeWorkspaceConfig(importedConfig);
        ui.success(
          'Workspace config imported successfully',
          `Location: ${getWorkspaceConfigPath()}`,
        );
      } catch (error: unknown) {
        const err = error as Error;
        ui.error('Failed to import config', err.message);
      }
    } else {
      ui.info('Using existing workspace config', `Location: ${getWorkspaceConfigPath()}`);
    }
  } else {
    initWorkspaceConfig();
    ui.success('Workspace config created', `Location: ${getWorkspaceConfigPath()}`);
  }
}

// Open workspace config in VS Code
export async function workspaceConfig() {
  if (!workspaceConfigExists()) {
    ui.error('Workspace config not found', "Run 'dk workspace init' to create one");
    return;
  }

  const configPath = getWorkspaceConfigPath();
  const spinner = ora('Opening config in VS Code...').start();

  try {
    await execAsync(`code "${configPath}"`);
    spinner.succeed('Config opened in VS Code');
  } catch (error: unknown) {
    spinner.fail('Failed to open VS Code');
    const err = error as Error;

    ui.error('Error', err.message);
    ui.info('Config location', configPath);
  }
}

// Execute workspace action
async function executeAction(
  action: WorkspaceAction,
  modulePath: string,
  moduleName: string,
): Promise<void> {
  const actionDesc = action.description || action.type;

  switch (action.type) {
    case 'open-in-vscode':
      console.log(chalk.gray(`  → Opening ${moduleName} in VS Code...`));
      try {
        await execAsync(`code "${modulePath}"`);
        console.log(chalk.green(`  ✓ Opened ${moduleName} in VS Code`));
      } catch (error: unknown) {
        const err = error as Error;
        console.log(chalk.red(`  ✗ Failed to open in VS Code: ${err.message}`));
      }
      break;

    case 'open-in-antigravity':
      console.log(chalk.gray(`  → Opening ${moduleName} in Antigravity...`));
      try {
        await execAsync(`antigravity "${modulePath}"`);
        console.log(chalk.green(`  ✓ Opened ${moduleName} in Antigravity`));
      } catch (error: unknown) {
        const err = error as Error;
        console.log(chalk.red(`  ✗ Failed to open in Antigravity: ${err.message}`));
      }
      break;

    case 'run-command':
      if (!action.command) {
        console.log(chalk.red(`  ✗ No command specified for ${moduleName}`));
        return;
      }
      console.log(chalk.gray(`  → Running: ${action.command}`));
      try {
        const { stdout, stderr } = await execAsync(action.command, {
          cwd: modulePath,
        });
        if (stdout) console.log(chalk.gray(stdout));
        if (stderr) console.log(chalk.yellow(stderr));
        console.log(chalk.green(`  ✓ Command completed`));
      } catch (error: unknown) {
        const err = error as Error;
        console.log(chalk.red(`  ✗ Command failed: ${err.message}`));
      }
      break;

    case 'run-script':
      if (!action.scriptPath) {
        console.log(chalk.red(`  ✗ No script path specified for ${moduleName}`));
        return;
      }
      console.log(chalk.gray(`  → Running script: ${action.scriptPath}`));
      try {
        // Determine if Windows or Unix
        const isWindows = process.platform === 'win32';
        const scriptCmd = isWindows
          ? `powershell -ExecutionPolicy Bypass -File "${action.scriptPath}"`
          : `bash "${action.scriptPath}"`;

        const { stdout, stderr } = await execAsync(scriptCmd, {
          cwd: modulePath,
        });
        if (stdout) console.log(chalk.gray(stdout));
        if (stderr) console.log(chalk.yellow(stderr));
        console.log(chalk.green(`  ✓ Script completed`));
      } catch (error: unknown) {
        const err = error as Error;
        console.log(chalk.red(`  ✗ Script failed: ${err.message}`));
      }
      break;

    case 'open-url':
      if (!action.url) {
        console.log(chalk.red(`  ✗ No URL specified for ${moduleName}`));
        return;
      }
      console.log(chalk.gray(`  → Opening URL: ${action.url}`));
      try {
        const isWindows = process.platform === 'win32';
        const isMac = process.platform === 'darwin';
        const openCmd = isWindows
          ? `start ${action.url}`
          : isMac
            ? `open ${action.url}`
            : `xdg-open ${action.url}`;

        await execAsync(openCmd);
        console.log(chalk.green(`  ✓ URL opened`));
      } catch (error: unknown) {
        const err = error as Error;
        console.log(chalk.red(`  ✗ Failed to open URL: ${err.message}`));
      }
      break;

    case 'open-folder':
      console.log(chalk.gray(`  → Opening folder: ${modulePath}`));
      try {
        const isWindows = process.platform === 'win32';
        const isMac = process.platform === 'darwin';
        const openCmd = isWindows
          ? `explorer "${modulePath}"`
          : isMac
            ? `open "${modulePath}"`
            : `xdg-open "${modulePath}"`;

        await execAsync(openCmd);
        console.log(chalk.green(`  ✓ Folder opened`));
      } catch (error: unknown) {
        const err = error as Error;
        console.log(chalk.red(`  ✗ Failed to open folder: ${err.message}`));
      }
      break;

    default:
      console.log(chalk.red(`  ✗ Unknown action type: ${action.type}`));
  }
}

// Process selected modules
async function processModules(modules: WorkspaceModule[], workspaceName: string) {
  console.log(chalk.cyan(`\n📦 Processing ${modules.length} module(s)...\n`));

  for (const module of modules) {
    console.log(chalk.bold(`\n${module.name}:`));

    // Validate path exists
    if (!existsSync(module.path)) {
      console.log(chalk.red(`  ✗ Path not found: ${module.path}`));
      continue;
    }

    // Execute actions sequentially
    for (const action of module.actions) {
      await executeAction(action, module.path, module.name);
      // Small delay between actions
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  console.log(chalk.green(`\n✓ Workspace "${workspaceName}" opened successfully!\n`));
}

// Main workspace selector
export async function workspace() {
  if (!workspaceConfigExists()) {
    ui.error('Workspace config not found', "Run 'dk workspace init' to create one");
    return;
  }

  const config = readWorkspaceConfig();

  if (config.workspaces.length === 0) {
    ui.warning('No workspaces configured', "Run 'dk workspace config' to add workspaces");
    return;
  }

  // Show workspace selector
  const workspaceChoices = config.workspaces.map((ws, index) => {
    const colorFn =
      (chalk as Record<ChalkColor, typeof chalk.cyan>)[(ws.color as ChalkColor) || 'cyan'] ||
      chalk.cyan;
    return {
      name: `${index + 1}. ${colorFn(ws.name)}${
        ws.description ? chalk.gray(` - ${ws.description}`) : ''
      }`,
      value: ws.name,
      short: ws.name,
    };
  });

  const { selectedWorkspace } = await inquirer.prompt({
    type: 'list',
    name: 'selectedWorkspace',
    message: chalk.bold('🎯 Select a workspace:'),
    choices: workspaceChoices,
    pageSize: 15,
  });

  const workspace = config.workspaces.find((ws) => ws.name === selectedWorkspace);

  if (!workspace) {
    ui.error('Workspace not found');
    return;
  }

  // Ask how to open modules
  const { openMode } = await inquirer.prompt({
    type: 'list',
    name: 'openMode',
    message: chalk.bold('📂 How would you like to open modules?'),
    choices: [
      { name: 'Open default modules only', value: 'default' },
      { name: 'Open all modules', value: 'all' },
      { name: 'Select modules manually', value: 'manual' },
      { name: 'Cancel', value: 'cancel' },
    ],
  });

  if (openMode === 'cancel') {
    ui.info('Operation cancelled');
    return;
  }

  let selectedModules: WorkspaceModule[] = [];

  if (openMode === 'default') {
    selectedModules = workspace.modules.filter((m) => m.isIncludeByDefault);
  } else if (openMode === 'all') {
    selectedModules = workspace.modules;
  } else {
    // Manual selection with checkboxes
    const moduleChoices = workspace.modules.map((module) => ({
      name: `${module.name} ${chalk.gray(`(${module.path})`)}`,
      value: module.name,
      checked: module.isIncludeByDefault,
    }));

    const { selectedModuleNames } = await inquirer.prompt({
      type: 'checkbox',
      name: 'selectedModuleNames',
      message: chalk.bold('Select modules to open (Space to toggle):'),
      choices: moduleChoices,
      pageSize: 15,
      validate: (answer) => {
        if (answer.length < 1) {
          return 'You must select at least one module';
        }
        return true;
      },
    });

    selectedModules = workspace.modules.filter((m) => selectedModuleNames.includes(m.name));
  }

  if (selectedModules.length === 0) {
    ui.warning('No modules selected');
    return;
  }

  // Process selected modules
  await processModules(selectedModules, workspace.name);
}

// List all workspaces
export async function workspaceList() {
  if (!workspaceConfigExists()) {
    ui.error('Workspace config not found', "Run 'dk workspace init' to create one");
    return;
  }

  const config = readWorkspaceConfig();

  if (config.workspaces.length === 0) {
    ui.warning('No workspaces configured', "Run 'dk workspace config' to add workspaces");
    return;
  }

  console.log(chalk.cyan('\n📋 Configured Workspaces:\n'));

  config.workspaces.forEach((ws, index) => {
    const colorFn =
      (chalk as Record<ChalkColor, typeof chalk.cyan>)[(ws.color as ChalkColor) || 'cyan'] ||
      chalk.cyan;
    console.log(chalk.bold(`${index + 1}. ${colorFn(ws.name)}`));
    if (ws.description) {
      console.log(chalk.gray(`   ${ws.description}`));
    }
    console.log(chalk.gray(`   Modules: ${ws.modules.length}`));
    ws.modules.forEach((module) => {
      const defaultTag = module.isIncludeByDefault ? chalk.green(' [default]') : '';
      console.log(chalk.gray(`   - ${module.name}${defaultTag}: ${module.path}`));
    });
    console.log();
  });
}
