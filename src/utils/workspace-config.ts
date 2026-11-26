// Workspace configuration management
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join, dirname, basename } from 'path';
import type { WorkspaceConfig, WorkspaceModule } from '../types/workspace.js';
import { readCloneConfig } from './clone-config.js';

// Get the workspace config file path based on OS
export function getWorkspaceConfigPath(): string {
  const home = homedir();
  const configDir = join(home, '.digicroz', 'dk');
  return join(configDir, 'workspaces.config.json');
}

// Check if workspace config exists
export function workspaceConfigExists(): boolean {
  return existsSync(getWorkspaceConfigPath());
}

// Create default workspace config
function createDefaultConfig(): WorkspaceConfig {
  const root = getReposRoot();
  return {
    version: '1.0.0',
    scanDirs: root ? [root] : [],
    workspaces: [],
  };
}

// Initialize workspace config directory and file
export function initWorkspaceConfig(): void {
  const configPath = getWorkspaceConfigPath();
  const configDir = dirname(configPath);

  // Create directory if it doesn't exist
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  // Create config file if it doesn't exist
  if (!existsSync(configPath)) {
    const defaultConfig = createDefaultConfig();
    writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), 'utf-8');
  }
}

// Read workspace config
export function readWorkspaceConfig(): WorkspaceConfig {
  const configPath = getWorkspaceConfigPath();

  if (!existsSync(configPath)) {
    throw new Error("Workspace config not found. Run 'dk workspace init' first.");
  }

  try {
    const content = readFileSync(configPath, 'utf-8');
    return JSON.parse(content) as WorkspaceConfig;
  } catch (error) {
    throw new Error(`Failed to read workspace config: ${error}`);
  }
}

// Write workspace config
export function writeWorkspaceConfig(config: WorkspaceConfig): void {
  const configPath = getWorkspaceConfigPath();
  const configDir = dirname(configPath);

  // Ensure directory exists
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  try {
    writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
  } catch (error) {
    throw new Error(`Failed to write workspace config: ${error}`);
  }
}

// Validate workspace config structure
export function validateWorkspaceConfig(config: Partial<WorkspaceConfig>): boolean {
  if (!config.version || !config.workspaces) {
    return false;
  }

  if (!Array.isArray(config.workspaces)) {
    return false;
  }

  for (const workspace of config.workspaces) {
    if (!workspace.name || !Array.isArray(workspace.modules)) {
      return false;
    }

    for (const module of workspace.modules) {
      if (
        !module.name ||
        !module.path ||
        module.isIncludeByDefault === undefined ||
        module.defaultActionIndex === undefined ||
        !Array.isArray(module.actions)
      ) {
        return false;
      }
    }
  }

  return true;
}

// Import workspace config from a file
export function importWorkspaceConfig(filePath: string): WorkspaceConfig {
  if (!existsSync(filePath)) {
    throw new Error(`Config file not found: ${filePath}`);
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    const config = JSON.parse(content) as WorkspaceConfig;

    if (!validateWorkspaceConfig(config)) {
      throw new Error('Invalid workspace config structure');
    }

    return config;
  } catch (error) {
    throw new Error(`Failed to import workspace config: ${error}`);
  }
}

// ---- ws.dk.json: per-repo module descriptor, discovered by `dk ws scan` ----
export const REPO_CONFIG_FILE = 'ws.dk.json';

export interface ScannedModule {
  workspace: string;
  module: WorkspaceModule;
  order?: number;
}

// Look for ws.dk.json in dir and up to `depth` levels below it.
// ponytail: plain recursive readdir; fine for a projects folder, slow if pointed at a drive root.
export function scanForRepoConfigs(dir: string, depth = 2): ScannedModule[] {
  const found: ScannedModule[] = [];
  const file = join(dir, REPO_CONFIG_FILE);
  if (existsSync(file)) {
    const c = JSON.parse(readFileSync(file, 'utf-8'));
    if (!c.workspace) throw new Error(`${file}: "workspace" is required`);
    found.push({
      workspace: c.workspace,
      order: typeof c.order === 'number' ? c.order : undefined,
      module: {
        name: c.name || basename(dir),
        path: dir,
        isIncludeByDefault: c.isIncludeByDefault ?? true,
        defaultActionIndex: c.defaultActionIndex ?? 0,
        actions: c.actions ?? [{ type: 'open-in-vscode' }],
      },
    });
  }
  if (depth > 0) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory() && e.name !== 'node_modules' && !e.name.startsWith('.')) {
        found.push(...scanForRepoConfigs(join(dir, e.name), depth - 1));
      }
    }
  }
  return found;
}

// Merge scanned modules into config: workspace by name, module by path (update in place).
export function mergeScanned(config: WorkspaceConfig, found: ScannedModule[]): void {
  for (const { workspace, module, order } of found) {
    let ws = config.workspaces.find((w) => w.name === workspace);
    if (!ws) config.workspaces.push((ws = { name: workspace, modules: [] }));
    if (order !== undefined) ws.order = order; // ponytail: last scanned module wins if several set it
    const i = ws.modules.findIndex((m) => m.path === module.path);
    if (i >= 0) ws.modules[i] = module;
    else ws.modules.push(module);
  }
}

// Repos folder that `dk clone` uses: <clone baseDir>/digicroz-repos. null if clone was never set up.
export function getReposRoot(): string | null {
  const base = readCloneConfig()?.clones[0]?.baseDir;
  if (!base) return null;
  // "C:" alone is drive-relative in node's path.join, so force the root slash.
  return join(/^[A-Za-z]:$/.test(base) ? base + '/' : base, 'digicroz-repos');
}

// Make sure scanDirs exists (default: repos root) and sits right after version, before workspaces.
// Also re-orders configs that were already backfilled with scanDirs at the end.
export function backfillScanDirs(): void {
  if (!workspaceConfigExists()) return;
  const config = readWorkspaceConfig();
  const root = getReposRoot();
  const scanDirs = config.scanDirs ?? (root ? [root] : undefined);
  if (!scanDirs) return;
  const { version, scanDirs: _old, ...rest } = config;
  const ordered = { version, scanDirs, ...rest };
  if (JSON.stringify(ordered) !== JSON.stringify(config)) writeWorkspaceConfig(ordered);
}

// Config used by `dk ws`: saved config + modules found via ws.dk.json under the repos root.
// ponytail: rescans on every run (2 levels deep) and merges in memory only, nothing is written.
export function loadWorkspaceConfig(): { config: WorkspaceConfig; warning?: string } {
  const config = workspaceConfigExists() ? readWorkspaceConfig() : createDefaultConfig();
  // Configs made before scanDirs existed fall back to the repos root.
  const dirs = config.scanDirs ?? [getReposRoot()].filter((d): d is string => !!d);
  const warnings: string[] = [];
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    try {
      mergeScanned(config, scanForRepoConfigs(dir));
    } catch (e) {
      warnings.push(e instanceof Error ? e.message : String(e));
    }
  }
  config.workspaces.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)); // stable: ties keep existing order
  return { config, warning: warnings.join('; ') || undefined };
}
