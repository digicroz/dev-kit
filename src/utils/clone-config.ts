// Workspace configuration management
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { CloneConfig } from "../types/clone";
import os from "node:os";
export function getCloneConfigPath(): string {
  const home = os.homedir();
  const configDir = join(home, ".digicroz", "dk");
  return join(configDir, "clone.config.json");
}
export function writeCloneConfig(config: CloneConfig): void {
  const configPath = getCloneConfigPath();
  const dir = dirname(configPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
}
export function readCloneConfig(): CloneConfig | null {
  const configPath = getCloneConfigPath();
  if (!existsSync(configPath)) {
    return null;
  }
  try {
    const content = readFileSync(configPath, "utf-8");
    return JSON.parse(content) as CloneConfig;
  } catch (error) {
    throw new Error(`Failed to read 
       clone config: ${error}`);
  }
}