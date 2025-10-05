import { ui } from "../utils/ui-helpers"
import { readConfig, writeConfig, isConfigOutdated } from "../utils/config"

export async function updateConfig() {
  const config = readConfig()
  if (!config) {
    ui.error("No dk.config.json found. Run dk init first.")
    return
  }
  if (!isConfigOutdated(config)) {
    ui.success("Your dk.config.json is already up to date!")
    return
  }
  // For now, just bump version and keep all fields
  writeConfig({ ...config })
  ui.success("dk.config.json updated to latest version!")
}
