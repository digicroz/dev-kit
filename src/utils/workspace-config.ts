// Workspace configuration management
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join, dirname } from "path";
import type { WorkspaceConfig } from "../types/workspace.js";

// Get the workspace config file path based on OS
export function getWorkspaceConfigPath(): string {
  const home = homedir();
  const configDir = join(home, ".digicroz", "dk");
  return join(configDir, "workspaces.config.json");
}

// Check if workspace config exists
export function workspaceConfigExists(): boolean {
  return existsSync(getWorkspaceConfigPath());
}

// Create default workspace config
function createDefaultConfig(): WorkspaceConfig {
  return {
    version: "1.0.0",
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
    writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), "utf-8");
  }
}

// Read workspace config
export function readWorkspaceConfig(): WorkspaceConfig {
  const configPath = getWorkspaceConfigPath();

  if (!existsSync(configPath)) {
    throw new Error(
      "Workspace config not found. Run 'dk workspace init' first."
    );
  }

  try {
    const content = readFileSync(configPath, "utf-8");
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
    writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
  } catch (error) {
    throw new Error(`Failed to write workspace config: ${error}`);
  }
}

// Validate workspace config structure
export function validateWorkspaceConfig(config: any): boolean {
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
    const content = readFileSync(filePath, "utf-8");
    const config = JSON.parse(content) as WorkspaceConfig;

    if (!validateWorkspaceConfig(config)) {
      throw new Error("Invalid workspace config structure");
    }

    return config;
  } catch (error) {
    throw new Error(`Failed to import workspace config: ${error}`);
  }
}
