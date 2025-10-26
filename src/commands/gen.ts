import { ui } from "../utils/ui-helpers.js"
import { readConfig } from "../utils/config.js"
import { generateImageIndex } from "./assets.js"

export const gen = async (): Promise<void> => {
  const config = readConfig()

  if (!config) {
    ui.error("Configuration not found", "Please run 'dk init' first")
    process.exit(1)
  }

  const supportedTypes = ["vite-react", "react-native-cli", "nextjs"]
  if (!supportedTypes.includes(config.projectType)) {
    ui.error(
      "Unsupported project type",
      `Generators are only supported for: ${supportedTypes.join(", ")}`
    )
    process.exit(1)
  }

  if (!config.generators?.assets) {
    ui.warning(
      "No generators configured",
      "Please configure generators in dk.config.json"
    )
    return
  }

  ui.section("⚡ Running Generators", "Generating all configured assets")

  const tasks: Array<{ name: string; fn: () => Promise<void> }> = []

  if (config.generators.assets.image) {
    tasks.push({
      name: "Image assets",
      fn: generateImageIndex,
    })
  }

  if (config.generators.assets.svg) {
    tasks.push({
      name: "SVG assets",
      fn: async () => {
        ui.info("SVG generation not yet implemented")
      },
    })
  }

  if (tasks.length === 0) {
    ui.warning("No generators found", "Configure generators in dk.config.json")
    return
  }

  for (const task of tasks) {
    ui.info(`Running ${task.name} generator...`)
    await task.fn()
  }

  ui.success("All generators completed!", `Ran ${tasks.length} generator(s)`)
}
