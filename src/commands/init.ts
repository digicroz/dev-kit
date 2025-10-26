import inquirer from "inquirer"
import { ui } from "../utils/ui-helpers"
import {
  configExists,
  writeConfig,
  detectProjectType,
  detectDatabaseConfig,
} from "../utils/config"
import { promises as fs } from "fs"
import path from "path"
import { existsSync } from "fs"
import type {
  DKProjectType,
  DatabaseConfig,
  DatabaseType,
  SpringBootConfig,
  GeneratorsConfig,
} from "../types/config"

const PROJECT_TYPES: { name: string; value: DKProjectType }[] = [
  { name: "Node.js (Express)", value: "node-express" },
  { name: "Vite + React", value: "vite-react" },
  { name: "React Native CLI", value: "react-native-cli" },
  { name: "Spring Boot Microservices", value: "spring-boot-microservice" },
  { name: "Next.js", value: "nextjs" },
]

async function createInitialVSCodeSettings(
  generatorsConfig?: GeneratorsConfig
): Promise<void> {
  const vscodeDir = path.join(process.cwd(), ".vscode")
  const settingsPath = path.join(vscodeDir, "settings.json")

  if (!existsSync(vscodeDir)) {
    await fs.mkdir(vscodeDir, { recursive: true })
  }

  let settings: any = {}

  if (existsSync(settingsPath)) {
    try {
      const settingsContent = await fs.readFile(settingsPath, "utf8")
      settings = JSON.parse(settingsContent)
    } catch (error) {
    }
  }

  if (!settings["files.readonlyInclude"]) {
    settings["files.readonlyInclude"] = {
      "dist/**": true,
      "node_modules/**": true,
    }
  }

  if (generatorsConfig?.assets) {
    const imageIndexPath = path.posix.join(
      generatorsConfig.assets.baseDir,
      generatorsConfig.assets.image?.baseDir || "images",
      "index.ts"
    )
    settings["files.readonlyInclude"][imageIndexPath] = true

    if (generatorsConfig.assets.svg) {
      const svgIndexPath = path.posix.join(
        generatorsConfig.assets.baseDir,
        generatorsConfig.assets.svg.baseDir,
        "index.ts"
      )
      settings["files.readonlyInclude"][svgIndexPath] = true
    }
  }

  await fs.writeFile(
    settingsPath,
    JSON.stringify(settings, null, 2) + "\n",
    "utf8"
  )
}

export async function init() {
  if (configExists()) {
    ui.info("dk.config.json already exists.", "No changes made.")
    return
  }

  let detected = detectProjectType()
  let projectType: DKProjectType | undefined = detected || undefined

  if (!projectType) {
    ui.warning("Unable to auto-detect project type.")
    const { type } = await inquirer.prompt({
      type: "list",
      name: "type",
      message: "Select your project type:",
      choices: PROJECT_TYPES,
    })
    projectType = type as DKProjectType
  } else {
    ui.success(`Detected project type: ${projectType}`)
  }

  if (projectType) {
    let databaseConfig: DatabaseConfig | undefined
    let springBootConfig: SpringBootConfig | undefined
    let generatorsConfig: GeneratorsConfig | undefined

    if (projectType === "node-express") {
      databaseConfig = await detectAndConfigureDatabase()
    }

    if (projectType === "spring-boot-microservice") {
      springBootConfig = await detectAndConfigureSpringBootServices()
    }

    const frontendTypes: DKProjectType[] = [
      "vite-react",
      "react-native-cli",
      "nextjs",
    ]
    if (frontendTypes.includes(projectType)) {
      generatorsConfig = await configureGenerators(projectType)
    }

    const config = {
      projectType,
      ...(databaseConfig && { database: databaseConfig }),
      ...(springBootConfig && { springBoot: springBootConfig }),
      ...(generatorsConfig && { generators: generatorsConfig }),
    }
    writeConfig(config)

    try {
      await createInitialVSCodeSettings(generatorsConfig)
      ui.info("VS Code settings configured with readonly includes")
    } catch (error) {
      ui.warning(
        "Failed to create VS Code settings",
        "You can configure them manually"
      )
    }

    ui.success("Created dk.config.json", `Project type: ${projectType}`)
    if (databaseConfig) {
      ui.info("Database configuration detected and added to config.")
    }
    if (springBootConfig) {
      ui.info("Spring Boot services detected and added to config.")
    }
    if (generatorsConfig) {
      ui.info("Generators configuration added to config.")
    }
  } else {
    ui.error("No project type selected. dk.config.json not created.")
  }
}

async function detectAndConfigureSpringBootServices(): Promise<
  SpringBootConfig | undefined
> {
  try {
    const fs = await import("fs")
    const path = await import("path")

    // Look for common Spring Boot microservice structure
    const currentDir = process.cwd()
    const items = fs.readdirSync(currentDir, { withFileTypes: true })

    const potentialServices = items
      .filter((item) => item.isDirectory())
      .map((dir) => dir.name)
      .filter((name) => {
        // Check if directory contains Spring Boot indicators
        const servicePath = path.join(currentDir, name)
        const hasPom = fs.existsSync(path.join(servicePath, "pom.xml"))
        const hasGradle =
          fs.existsSync(path.join(servicePath, "build.gradle")) ||
          fs.existsSync(path.join(servicePath, "build.gradle.kts"))
        const hasMvnw =
          fs.existsSync(path.join(servicePath, "mvnw")) ||
          fs.existsSync(path.join(servicePath, "mvnw.cmd"))

        return hasPom || hasGradle || hasMvnw
      })

    if (potentialServices.length === 0) {
      ui.warning("No Spring Boot services detected in current directory.")
      return undefined
    }

    ui.info(`Found ${potentialServices.length} potential Spring Boot services:`)
    potentialServices.forEach((service) => ui.info(`  - ${service}`))

    const { configureServices } = await inquirer.prompt({
      type: "confirm",
      name: "configureServices",
      message: "Would you like to configure these services for management?",
      default: true,
    })

    if (!configureServices) {
      return undefined
    }

    const services = []

    for (let i = 0; i < potentialServices.length; i++) {
      const serviceName = potentialServices[i]

      const { includeService } = await inquirer.prompt({
        type: "confirm",
        name: "includeService",
        message: `Include ${serviceName} in configuration?`,
        default: true,
      })

      if (includeService) {
        const { startOrder } = await inquirer.prompt({
          type: "number",
          name: "startOrder",
          message: `Starting order for ${serviceName} (0-based index):`,
          default: i,
          validate: (input: number | undefined) =>
            (input !== undefined && input >= 0) ||
            "Starting order must be 0 or greater",
        })

        services.push({
          name: serviceName,
          path: serviceName,
          startingOrderIndex: startOrder,
        })
      }
    }

    if (services.length === 0) {
      return undefined
    }

    // Sort services by starting order
    services.sort((a, b) => a.startingOrderIndex - b.startingOrderIndex)

    return { services }
  } catch (error: any) {
    ui.warning(
      "Failed to detect Spring Boot services:",
      error?.message || String(error)
    )
    return undefined
  }
}

async function detectAndConfigureDatabase(): Promise<
  DatabaseConfig | undefined
> {
  const detectedConfig = detectDatabaseConfig()

  if (!detectedConfig) {
    return undefined
  }

  let config = { ...detectedConfig }

  // If database type couldn't be detected from env, ask user
  if (config.dbUrlEnvName && !config.dbType) {
    ui.warning("Found database URL but couldn't determine database type.")

    const { dbType } = await inquirer.prompt({
      type: "list",
      name: "dbType",
      message: "What type of database are you using?",
      choices: [
        { name: "MySQL", value: "mysql" },
        { name: "PostgreSQL", value: "postgres" },
        { name: "SQLite", value: "sqlite" },
        { name: "MongoDB", value: "mongodb" },
      ],
    })

    config.dbType = dbType as DatabaseType
  }

  // If database name couldn't be extracted, ask user
  if (config.dbUrlEnvName && !config.dbName) {
    const { dbName } = await inquirer.prompt({
      type: "input",
      name: "dbName",
      message: "What is your database name?",
      validate: (input: string) =>
        input.trim().length > 0 || "Database name cannot be empty",
    })

    config.dbName = dbName.trim()
  }

  return config
}

async function configureGenerators(
  projectType: DKProjectType
): Promise<GeneratorsConfig | undefined> {
  const { configureAssets } = await inquirer.prompt({
    type: "confirm",
    name: "configureAssets",
    message: "Would you like to configure automatic asset type generation?",
    default: true,
  })

  if (!configureAssets) {
    return undefined
  }

  const fs = await import("fs")
  const srcAssetsImages = "src/assets/images"
  const srcAssetsImagesExists = fs.existsSync(srcAssetsImages)

  let defaultBaseDir = ""
  let defaultImageDir = "images"

  if (srcAssetsImagesExists) {
    defaultBaseDir = "src/assets"
    defaultImageDir = "images"
  } else {
    switch (projectType) {
      case "vite-react":
      case "react-native-cli":
        defaultBaseDir = "src/assets"
        defaultImageDir = "images"
        break
      case "nextjs":
        defaultBaseDir = "public"
        defaultImageDir = "images"
        break
    }
  }

  const { baseDir } = await inquirer.prompt({
    type: "input",
    name: "baseDir",
    message: "Enter the base directory for assets:",
    default: defaultBaseDir,
    validate: (input: string) => {
      if (!input.trim()) {
        return "Base directory path cannot be empty"
      }
      return true
    },
  })

  const { imageDir } = await inquirer.prompt({
    type: "input",
    name: "imageDir",
    message: "Enter the directory for images (relative to base directory):",
    default: defaultImageDir,
    validate: (input: string) => {
      if (!input.trim()) {
        return "Images directory path cannot be empty"
      }
      return true
    },
  })

  const { imageNameCase } = await inquirer.prompt({
    type: "list",
    name: "imageNameCase",
    message: "How would you like image files to be named?",
    choices: [
      { name: "kebab-case (my-image.png)", value: "kebab-case" },
      { name: "snake_case (my_image.png)", value: "snake_case" },
      { name: "any (keep original names)", value: "any" },
    ],
    default: "kebab-case",
  })

  const { infoComment } = await inquirer.prompt({
    type: "list",
    name: "infoComment",
    message: "How would you like the info comment in generated index.ts?",
    choices: [
      { name: "Short info comment (default)", value: "short_info" },
      { name: "Hidden (no comment)", value: "hidden" },
    ],
    default: "short_info",
  })

  const { configureSvg } = await inquirer.prompt({
    type: "confirm",
    name: "configureSvg",
    message: "Would you like to also configure SVG generation?",
    default: false,
  })

  let svgConfig = undefined

  if (configureSvg) {
    const { svgDir } = await inquirer.prompt({
      type: "input",
      name: "svgDir",
      message: "Enter the directory for SVGs (relative to base directory):",
      default: "svg",
      validate: (input: string) => {
        if (!input.trim()) {
          return "SVG directory path cannot be empty"
        }
        return true
      },
    })

    const { svgNameCase } = await inquirer.prompt({
      type: "list",
      name: "svgNameCase",
      message: "How would you like SVG files to be named?",
      choices: [
        { name: "kebab-case (my-icon.svg)", value: "kebab-case" },
        { name: "snake_case (my_icon.svg)", value: "snake_case" },
        { name: "any (keep original names)", value: "any" },
      ],
      default: "kebab-case",
    })

    const { svgInfoComment } = await inquirer.prompt({
      type: "list",
      name: "svgInfoComment",
      message: "How would you like the info comment in generated SVG index.ts?",
      choices: [
        { name: "Short info comment (default)", value: "short_info" },
        { name: "Hidden (no comment)", value: "hidden" },
      ],
      default: "short_info",
    })

    svgConfig = {
      baseDir: svgDir.trim(),
      nameCase: svgNameCase,
      infoComment: svgInfoComment,
    }
  }

  return {
    assets: {
      baseDir: baseDir.trim(),
      image: {
        baseDir: imageDir.trim(),
        nameCase: imageNameCase,
        infoComment: infoComment,
      },
      ...(svgConfig && { svg: svgConfig }),
    },
  }
}
