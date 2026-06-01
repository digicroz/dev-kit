import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { ui } from '../utils/ui-helpers.js';
import { readConfig } from '../utils/config.js';

interface DeployInfo {
  last_deploy: string;
  hash: string;
  version: string;
}

interface DkConfig {
  deploy?: {
    uat?: string | string[];
    prod?: string | string[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * Display error message and exit
 */
function displayError(message: string): never {
  console.error(chalk.red(`Error: ${message}`));
  console.log('Press any key to close...');
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on('data', () => process.exit(1));
  process.exit(1);
}

/**
 * Execute command and handle errors
 */
function executeCommand(command: string, errorMessage: string): string {
  try {
    return execSync(command, { encoding: 'utf8', stdio: 'pipe' }).toString().trim();
  } catch (error) {
    displayError(`${errorMessage}: ${error}`);
  }
}

/**
 * Check if package.json exists and return path
 */
function getPackageJsonPath(): string {
  const packagePath = path.join(process.cwd(), 'package.json');
  if (!fs.existsSync(packagePath)) {
    displayError('package.json not found.');
  }
  return packagePath;
}
interface PackageJson {
  name?: string;
  version?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  [key: string]: unknown; // allow extra fields
}
/**
 * Read and parse package.json
 */
function readPackageJson(): PackageJson {
  const packagePath = getPackageJsonPath();
  try {
    const content = fs.readFileSync(packagePath, 'utf8');
    return JSON.parse(content) as PackageJson;
  } catch (error) {
    displayError('Failed to read or parse package.json.');
  }
}

/**
 * Write package.json
 */
function writePackageJson(packageData: PackageJson): void {
  const packagePath = getPackageJsonPath();
  try {
    fs.writeFileSync(packagePath, JSON.stringify(packageData, null, 2) + '\n');
  } catch (error) {
    displayError('Failed to write package.json.');
  }
}

/**
 * Read deploy.json if it exists
 */
function readDeployInfo(): DeployInfo | null {
  const deployPath = path.join(process.cwd(), 'deploy.json');
  if (!fs.existsSync(deployPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(deployPath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.warn(
      chalk.yellow('Warning: Failed to read deploy.json, treating as first deployment.'),
    );
    return null;
  }
}

/**
 * Read dk.config.json if it exists and return parsed object
 */
function readDkConfig(): DkConfig | null {
  const cfgPath = path.join(process.cwd(), 'dk.config.json');
  if (!fs.existsSync(cfgPath)) return null;

  try {
    const content = fs.readFileSync(cfgPath, 'utf8');
    return JSON.parse(content) as DkConfig;
  } catch (error) {
    console.warn(chalk.yellow('Warning: Failed to read dk.config.json, ignoring.'));
    return null;
  }
}

function isNpmLoggedIn(): boolean {
  try {
    const result = execSync('npm whoami', { encoding: 'utf8', stdio: 'pipe' }).toString().trim();
    return result.length > 0;
  } catch {
    return false;
  }
}

async function ensureNpmLogin(): Promise<void> {
  if (isNpmLoggedIn()) {
    return;
  }

  ui.warning('NPM login required', 'You must be logged in to npm before releasing a package.');

  const { loginNow } = await inquirer.prompt({
    type: 'confirm',
    name: 'loginNow',
    message: 'You are not logged in to npm. Would you like to run npm login now?',
    default: true,
  });

  if (!loginNow) {
    displayError('NPM login is required to release npm packages.');
  }

  const loginProcess = spawn('npm', ['login'], { stdio: 'inherit' });

  await new Promise<void>((resolve, reject) => {
    loginProcess.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`npm login exited with code ${code}`));
      }
    });
    loginProcess.on('error', reject);
  });

  if (!isNpmLoggedIn()) {
    displayError('NPM login failed or was not completed.');
  }
}

export const releaseNpmPackage = async () => {
  const config = readConfig();
  if (!config) {
    displayError('dk.config.json not found. Run dk init first.');
  }

  if (config.projectType !== 'npm-package') {
    displayError(
      "Release is only supported for 'npm-package' projects. Use dk deploy for other project types.",
    );
  }

  await ensureNpmLogin();

  const { releaseType } = await inquirer.prompt({
    type: 'list',
    name: 'releaseType',
    message: 'Select release type:',
    choices: [
      { name: 'Patch (bug fixes)', value: 'patch' },
      { name: 'Minor (new features)', value: 'minor' },
      { name: 'Major (breaking changes)', value: 'major' },
    ],
    default: 'patch',
  });

  console.log(chalk.blue(`📦 Running npm version ${releaseType}...`));
  executeCommand(
    `npm version ${releaseType}`,
    `Failed to bump package version using npm version ${releaseType}`,
  );
  console.log(chalk.green(`✅ Package version updated with npm version ${releaseType}`));
};

/**
 * Run one or more custom commands (string or array) with output streamed to console
 */
function runCustomCommands(commands: string | string[], envName: string) {
  const cmds = Array.isArray(commands) ? commands : [commands];

  ui.info(`Running custom deploy commands for ${envName}`, cmds.join(' && '));

  for (const cmd of cmds) {
    try {
      execSync(cmd, { stdio: 'inherit' });
    } catch (error) {
      displayError(`Custom command failed (${cmd}): ${error}`);
    }
  }
}

/**
 * Write deploy.json
 */
function writeDeployInfo(deployInfo: DeployInfo): void {
  const deployPath = path.join(process.cwd(), 'deploy.json');
  try {
    fs.writeFileSync(deployPath, JSON.stringify(deployInfo, null, 2) + '\n');
  } catch (error) {
    displayError('Failed to write deploy.json.');
  }
}

/**
 * Increment version number
 */
function incrementVersion(version: string): string {
  const parts = version.split('.');
  if (parts.length !== 3) {
    displayError('Invalid version format. Expected semantic versioning (x.y.z).');
  }

  const [major, minor, patch] = parts.map(Number);
  if (parts.some((part) => isNaN(Number(part)))) {
    displayError('Invalid version format. All parts must be numbers.');
  }

  return `${major}.${minor}.${patch + 1}`;
}

/**
 * Check if there are uncommitted changes
 */
function hasUncommittedChanges(): boolean {
  try {
    const result = execSync('git status --porcelain', { encoding: 'utf8' });
    return result.trim().length > 0;
  } catch (error) {
    displayError('Failed to check git status.');
  }
}

/**
 * Check if a branch exists on remote origin
 */
function checkRemoteBranchExists(branchName: string): boolean {
  try {
    const result = execSync(`git ls-remote --heads origin ${branchName}`, {
      encoding: 'utf8',
      stdio: 'pipe',
    });
    return result.trim().length > 0;
  } catch (error) {
    return false;
  }
}

/**
 * Get current git branch
 */
function getCurrentBranch(): string {
  try {
    return execSync('git branch --show-current', { encoding: 'utf8' }).trim();
  } catch (error) {
    displayError('Failed to get current git branch.');
  }
}

/**
 * Create and publish a new branch
 */
function createAndPublishBranch(branchName: string): void {
  try {
    // Create branch from current branch
    executeCommand(`git checkout -b ${branchName}`, `Failed to create ${branchName} branch`);

    // Push the new branch to remote
    executeCommand(
      `git push -u origin ${branchName}`,
      `Failed to push ${branchName} branch to remote`,
    );

    // Switch back to main
    executeCommand('git checkout main', 'Failed to switch back to main branch');

    ui.success(`✅ ${branchName} branch created and published successfully!`);
  } catch (error) {
    displayError(`Failed to create and publish ${branchName} branch: ${error}`);
  }
}

/**
 * Prompt user to create missing branch
 */
async function promptToCreateBranch(branchName: string): Promise<boolean> {
  ui.warning(
    `${branchName} branch not found`,
    `The ${branchName} branch is required for deployment but doesn't exist on remote.`,
  );

  const { shouldCreate } = await inquirer.prompt({
    type: 'confirm',
    name: 'shouldCreate',
    message: `Would you like to create and publish the ${branchName} branch?`,
    default: true,
  });

  return shouldCreate;
}

/**
 * Deploy to UAT environment
 */
export const deployUat = async () => {
  console.log(chalk.blue('🚀 Deploying to UAT environment...'));

  const config = readConfig();
  if (config?.projectType === 'npm-package') {
    displayError("Deploy is not supported for 'npm-package' projects. Use 'dk release' instead.");
  }

  // If dk.config.json provides custom deploy commands for uat, run them instead
  const dkConfig = readDkConfig();
  if (dkConfig?.deploy?.uat) {
    runCustomCommands(dkConfig.deploy.uat, 'uat');
    return;
  }

  try {
    // Check if uat branch exists on remote
    if (!checkRemoteBranchExists('uat')) {
      const shouldCreate = await promptToCreateBranch('uat');

      if (shouldCreate) {
        createAndPublishBranch('uat');
      } else {
        ui.info('Deployment cancelled', 'uat branch is required for development deployment.');
        return;
      }
    }

    executeCommand('git push origin main:uat --force', 'Failed to push to uat branch');
    console.log(chalk.green('✅ Successfully deployed to development environment!'));
  } catch (error) {
    displayError('Deployment to uat failed.');
  }
};

/**
 * Deploy to production environment
 */
export const deployProd = async () => {
  console.log(chalk.blue('🚀 Starting production deployment...'));

  const config = readConfig();
  if (config?.projectType === 'npm-package') {
    displayError("Deploy is not supported for 'npm-package' projects. Use 'dk release' instead.");
  }

  // If dk.config.json provides custom deploy commands for prod, run them instead
  const dkConfig = readDkConfig();
  if (dkConfig?.deploy?.prod) {
    runCustomCommands(dkConfig.deploy.prod, 'prod');
    return;
  }

  // Check if stable branch exists on remote
  if (!checkRemoteBranchExists('stable')) {
    const shouldCreate = await promptToCreateBranch('stable');

    if (shouldCreate) {
      createAndPublishBranch('stable');
    } else {
      ui.info('Deployment cancelled', 'stable branch is required for production deployment.');
      return;
    }
  }

  // Pull from stable branch
  executeCommand(
    'git pull origin stable --strategy-option=ours --no-edit',
    'Failed to pull changes from stable branch',
  );

  // Check for uncommitted changes
  if (hasUncommittedChanges()) {
    displayError(
      'There are uncommitted changes. Please commit or stash your changes before running this script.',
    );
  }

  // Check if on main branch
  if (getCurrentBranch() !== 'main') {
    displayError('You must be on the main branch to run this script.');
  }

  // Read current package.json
  const packageData = readPackageJson();
  const currentVersion = packageData.version;

  if (!currentVersion) {
    displayError('No version found in package.json.');
  }

  // Load last deployment information
  const deployInfo = readDeployInfo();
  const lastVersion = deployInfo?.version || '';

  // Check if version needs to be incremented
  let newVersion = currentVersion;
  if (currentVersion === lastVersion) {
    console.log(chalk.yellow('📦 Incrementing version...'));
    newVersion = incrementVersion(currentVersion);
    packageData.version = newVersion;
    writePackageJson(packageData);

    // Run npm install
    console.log(chalk.blue('📥 Installing npm packages...'));
    executeCommand('npm install', 'Failed to install npm packages');

    console.log(chalk.green(`✅ Version incremented from ${currentVersion} to ${newVersion}`));
  }

  // Get current date and time
  const datetime = new Date().toISOString().replace('T', ' ').substring(0, 19);

  // Store deployment information
  const newDeployInfo: DeployInfo = {
    last_deploy: datetime,
    hash: deployInfo?.hash || '',
    version: newVersion,
  };

  writeDeployInfo(newDeployInfo);

  // Stage all changes
  executeCommand('git add .', 'Failed to stage changes');

  // Commit changes
  const commitMessage = `${datetime}-V${newVersion} Production Deployment`;
  executeCommand(`git commit -m "${commitMessage}"`, 'Failed to commit changes');

  // Push to main
  executeCommand('git push origin main', 'Failed to push to main branch');

  // Create pull request
  console.log(chalk.blue('📋 Creating pull request...'));
  const prTitle = `V${newVersion} Deploy PR`;
  const prBody = `${datetime}-V${newVersion} Production Deployment`;

  try {
    executeCommand(
      `gh pr create --base stable --head main --title "${prTitle}" --body "${prBody}"`,
      'Failed to create pull request',
    );
    executeCommand('gh pr view --web', 'Failed to open pull request in browser');
    console.log(chalk.green('✅ Pull request created successfully!'));
  } catch (error) {
    console.warn(
      chalk.yellow(
        '⚠️  Pull request creation failed. Make sure GitHub CLI is installed and authenticated.',
      ),
    );
  }

  console.log(chalk.green('🎉 Production deployment completed successfully!'));
};

/**
 * Increment version command (extracted from your increment-version.sh script)
 */
export const incrementVersionCommand = () => {
  console.log(chalk.blue('📦 Incrementing version...'));

  // Checkout main and pull latest changes
  executeCommand('git checkout main', 'Failed to checkout main branch');
  executeCommand('git pull origin main', 'Failed to pull changes from main branch');
  executeCommand('git push origin main', 'Failed to push changes to main branch');

  // Read package.json
  const packageData = readPackageJson();
  const currentVersion = packageData.version;

  if (!currentVersion) {
    displayError('No version found in package.json.');
  }

  // Increment version
  const newVersion = incrementVersion(currentVersion);
  packageData.version = newVersion;
  writePackageJson(packageData);

  console.log(chalk.green(`✅ Version incremented from ${currentVersion} to ${newVersion}`));

  // Stage changes
  executeCommand('git add .', 'Failed to stage changes');

  // Install npm packages
  console.log(chalk.blue('📥 Installing npm packages...'));
  executeCommand('npm install', 'Failed to install npm packages');

  // Commit and push
  executeCommand(`git commit -m "Increment version to ${newVersion}"`, 'Failed to commit changes');
  executeCommand('git push origin main', 'Failed to push changes to main branch');

  // Pull latest changes
  executeCommand('git pull origin main --no-edit', 'Failed to pull changes from main branch');

  console.log(chalk.green('🎉 Version increment completed successfully!'));
};
