// Main entry point for the advanced development kit
import { readFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

export * from "./commands/clean"
export * from "./commands/git"

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Read version from package.json
function getVersionFromPackageJson(): string {
  try {
    const packageJsonPath = join(__dirname, "..", "package.json")
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"))
    return packageJson.version
  } catch (error) {
    console.warn(
      "Could not read version from package.json, falling back to default"
    )
    return "1.0.0"
  }
}

// Version information
export const VERSION = getVersionFromPackageJson()

// Utility functions
export function getToolkitInfo() {
  return {
    name: "Advanced Development Kit",
    version: VERSION,
    description: "A comprehensive toolkit for modern development workflows",
  }
}
