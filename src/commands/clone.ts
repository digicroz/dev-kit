import { exec, execSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import inquirer from 'inquirer';
import os from 'node:os';
import path, { dirname, join } from 'path';
import { promisify } from 'util';
import { CloneConfig, osTypes } from '../types/clone';
import { getCloneConfigPath, readCloneConfig, writeCloneConfig } from '../utils/clone-config';
import { ui } from '../utils/ui-helpers';
import fs from 'fs';
const execAsync = promisify(exec);

function getRootDrives(): Promise<string[]> {
  return new Promise((resolve, reject) => {
    exec(
      'powershell -Command "Get-PSDrive -PSProvider FileSystem | ForEach-Object { $_.Name }"',
      (err, stdout) => {
        if (err) return reject(err);

        const drives = stdout
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => /^[A-Z]$/.test(line))
          .map((letter) => `${letter}:`);
        resolve(drives);
      },
    );
  });
}
async function formatTargetDir(repoUrl: string): Promise<string> {
  const parts = repoUrl.split('/');
  let repoName = parts[parts.length - 1];
  if (!repoName.includes('--')) {
    ui.error('Invalid repository link. Expected format: project--module');
    process.exit(1);
  }

  repoName = repoName.replace(/--/g, '/');

  const config = readCloneConfig();
  let baseDir: string;
  let osType: osTypes;

  if (!config || config.clones.length === 0) {
    // Ask user

    osType = os.platform() as osTypes;

    if (osType === 'win32') {
      const drives = await getRootDrives();
      const { dirChoice } = await inquirer.prompt({
        type: 'list',
        name: 'dirChoice',
        message: 'Choose a base directory option:',
        choices: drives,
      });
      baseDir = dirChoice;
    } else {
      const { chosenDir } = await inquirer.prompt({
        type: 'list',
        name: 'chosenDir',
        message: 'Choose a base directory:',
        choices: [
          { name: 'Root Directory (/root)', value: '/root' },
          { name: 'Home Directory (~)', value: os.homedir() },
        ],
      });

      baseDir = chosenDir;
    }

    //save config
    const newConfig: CloneConfig = { version: '1.0.0', clones: [] };
    newConfig.clones.push({ os: osType, baseDir });
    writeCloneConfig(newConfig);
  } else {
    baseDir = config.clones[0].baseDir;
    osType = config.clones[0].os;
  }

  return path.join(baseDir, 'digicroz-repos', repoName);
}

export const clone = async (reposUrl?: string) => {
  const repoUrl = process.argv[3] || reposUrl;

  if (!repoUrl) {
    ui.error('No repository URL provided. Usage: dk clone <repo-url>');
    process.exit(1);
  }

  const targetDir = await formatTargetDir(repoUrl);
  ui.section('📦 Clone Repository', `Cloning ${repoUrl} into ${targetDir}`);
  if (existsSync(targetDir)) {
    const { overwrite } = await inquirer.prompt({
      type: 'confirm',
      name: 'overwrite',
      message: `The directory ${targetDir} already exists. Do you want to delete it and re‑clone?`,
      default: false,
    });

    if (!overwrite) {
      ui.info('Clone cancelled. Existing directory was not modified.');
      return;
    }

    ui.info(`Deleting existing directory ${targetDir}...`);
    fs.rmSync(targetDir, { recursive: true, force: true });
  }

  try {
    ui.info(`Running git clone ${repoUrl} ${targetDir}...`);
    execSync(`git clone ${repoUrl} ${targetDir}`, {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
    ui.success('Repository cloned successfully!', `Cloned into ${targetDir}`);
  } catch (error) {
    ui.error(
      'Failed to start development server',
      error instanceof Error ? error.message : 'Unknown error',
    );
    process.exit(1);
  }
};
export function clearCloneConfig(): void {
  const configPath = getCloneConfigPath();
  if (existsSync(configPath)) {
    const emptyConfig: CloneConfig = { version: '1.0.0', clones: [] };
    writeFileSync(configPath, JSON.stringify(emptyConfig, null, 2), 'utf-8');
    ui.info('Clone config cleared successfully.');
  } else {
    ui.info('No clone config file found to clear.');
  }
}
