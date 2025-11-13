import { Command } from "commander"
import chalk from "chalk"
import inquirer from "inquirer"
import { readFileSync } from "fs"
import { fileURLToPath } from "url"
import { dirname, join } from "path"
import boxen from "boxen"
import gradientString from "gradient-string"
import figlet from "figlet"
import ora from "ora"

import { clean } from "../src/commands/clean.js"
import { deployDev, deployProd } from "../src/commands/deploy.js"
import { doctor } from "../src/commands/doctor.js"
import {
  buildAndroidRelease,
  buildAndroidDebug,
} from "../src/commands/reactNative.js"
import { ui } from "../src/utils/ui-helpers.js"
import {
  configExists,
  readConfig,
  isConfigOutdated,
} from "../src/utils/config.js"
import { init as runInit } from "../src/commands/init.js"
import { updateConfig } from "../src/commands/config.js"
import { startSpringBootServices } from "../src/commands/springBoot.js"
import { gen } from "../src/commands/gen.js"
import { gitFix, gitAddCommit, gitAddCommitPush } from "../src/commands/git.js"
import {
  dbStatus,
  dbDumpCreate,
  dbDumpApply,
  dbDropAllTables,
} from "../src/commands/database.js"

// Get package.json version
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const packageJson = JSON.parse(
  readFileSync(join(__dirname, "../package.json"), "utf8")
)
const version = packageJson.version

// Beautiful animated welcome banner
async function showWelcomeBanner() {
  console.clear()

  // More compact ASCII Art Title
  const title = figlet.textSync("DK", {
    font: "Slant",
    horizontalLayout: "fitted",
    width: 50,
  })

  // Show title with rainbow gradient
  console.log(gradientString.rainbow(title))

  // Compact welcome box with better styling
  const welcomeMessage = boxen(
    gradientString("cyan", "blue")("🚀 Development Kit") +
      chalk.gray(" v" + version) +
      "\n" +
      chalk.cyan("━".repeat(20)) +
      "\n" +
      chalk.white("Fast • Beautiful • Modern ⚡"),
    {
      padding: { top: 0, bottom: 0, left: 1, right: 1 },
      margin: { top: 0, bottom: 1, left: 0, right: 0 },
      borderStyle: "round",
      borderColor: "cyan",
      backgroundColor: "#0a0a1e",
    }
  )

  console.log(welcomeMessage)
}

// Enhanced command wrapper with loading animation
function createEnhancedCommand(
  name: string,
  description: string,
  action: Function
) {
  return {
    name,
    description: chalk.gray(description),
    async execute(...args: any[]) {
      const spinner = ora({
        text: chalk.cyan(`Executing ${name}...`),
        spinner: "dots12",
        color: "cyan",
      }).start()

      try {
        await new Promise((resolve) => setTimeout(resolve, 300)) // Brief delay for UX
        spinner.stop()
        console.log(chalk.green("✓"), chalk.bold(`${name} ready`))
        await action(...args)
      } catch (error: any) {
        spinner.stop()

        // Handle user cancellation gracefully
        if (
          error.name === "ExitPromptError" ||
          error.message?.includes("SIGINT")
        ) {
          console.log("\n")
          console.log(
            boxen(
              chalk.yellow("⚠️ ") + chalk.white(`${name} cancelled by user`),
              {
                padding: { top: 0, bottom: 0, left: 1, right: 1 },
                borderStyle: "round",
                borderColor: "yellow",
                backgroundColor: "#1a1a00",
              }
            )
          )
          return
        }

        // Handle other errors
        spinner.fail(chalk.red(`Failed to execute ${name}`))
        console.error(chalk.red("Error:"), error)
        process.exit(1)
      }
    },
  }
}

// Enhanced error handling and beautiful exit
process.on("SIGINT", () => {
  // Only handle SIGINT if we're not in the middle of a prompt
  if (!process.stdin.isTTY || process.stdin.readableEnded) {
    console.log("\n")
    console.log(
      gradientString(
        "yellow",
        "orange"
      )("👋 Thanks for using DK! See you soon! ✨")
    )
    process.exit(0)
  }
})

process.on("uncaughtException", (error) => {
  console.log("\n")
  console.log(
    boxen(chalk.red("💥 Error: ") + chalk.white(error.message), {
      padding: { top: 0, bottom: 0, left: 1, right: 1 },
      borderStyle: "round",
      borderColor: "red",
      backgroundColor: "#1a0000",
    })
  )
  process.exit(1)
})

// Main execution function
async function main() {
  // Register config upgrade command
  const program = new Command()

  const configCmd = program
    .command("config")
    .description(chalk.gray("Manage dk.config.json"))

  configCmd
    .command("update")
    .description(chalk.gray("Update dk.config.json to latest version"))
    .action(async () => {
      await updateConfig()
    })
  // Show banner only at the start
  await showWelcomeBanner()

  // Ensure dk.config.json exists before running any command except init/config
  const isInitCmd = process.argv.includes("init")
  const isConfigCmd = process.argv.includes("config")
  if (!configExists() && !isInitCmd && !isConfigCmd) {
    ui.info("dk.config.json not found. Running init...")
    await runInit()
  }

  // Check config version and warn if outdated
  if (configExists() && !isInitCmd && !isConfigCmd) {
    const config = readConfig()
    if (isConfigOutdated(config)) {
      ui.warning(
        "Your dk.config.json is outdated.",
        "Run 'dk config update' to update your config file."
      )
    }
  }

  program
    .name(chalk.bold.cyan("dk"))
    .description(chalk.gray("Modern CLI toolkit with style"))
    .version(version, "-v, --version", chalk.gray("Show version"))
    .helpOption("-h, --help", chalk.gray("Show help"))
    .configureHelp({
      sortSubcommands: true,
      subcommandTerm: (cmd) => chalk.cyan("  " + cmd.name()),
      commandUsage: (cmd) =>
        chalk.yellow(cmd.name()) + chalk.gray(" [options]"),
      commandDescription: (cmd) => "  " + chalk.gray(cmd.description()),
      optionTerm: (option) => chalk.green("  " + option.flags),
      optionDescription: (option) => "  " + chalk.gray(option.description),
    })

  program
    .command("init")
    .alias("i")
    .description(chalk.gray("🚀 Initialize dk.config.json"))
    .action(async (...args) => {
      const cmd = createEnhancedCommand(
        "init",
        "Initializing configuration",
        runInit
      )
      await cmd.execute(...args)
    })

  program
    .command("clean")
    .alias("c")
    .description(chalk.gray("🧹 Clean temporary files"))
    .action(async (...args) => {
      const cmd = createEnhancedCommand("clean", "Cleaning project", clean)
      await cmd.execute(...args)
    })

  program
    .command("doctor")
    .alias("dr")
    .description(chalk.gray("🩺 System health check"))
    .action(async (...args) => {
      const cmd = createEnhancedCommand("doctor", "Running diagnostics", doctor)
      await cmd.execute(...args)
    })

  // Enhanced Deploy command with beautiful UI
  const deployCommand = program
    .command("deploy")
    .alias("d")
    .description(chalk.gray("🚀 Deploy with confidence"))
    .action(async () => {
      try {
        console.log(
          boxen(
            gradientString("magenta", "cyan")("🚀 Deployment Center") +
              "\n" +
              chalk.gray("Choose your destination"),
            {
              padding: { top: 0, bottom: 0, left: 1, right: 1 },
              margin: { top: 1, bottom: 1, left: 0, right: 0 },
              borderStyle: "round",
              borderColor: "magenta",
              backgroundColor: "#0a0a1a",
            }
          )
        )

        const { environment } = await inquirer.prompt({
          type: "list",
          name: "environment",
          message: chalk.bold("🎯 Select environment:"),
          choices: [
            {
              name:
                chalk.green("🔧 Development") + chalk.gray(" (quick deploy)"),
              value: "dev",
              short: "Development",
            },
            {
              name: chalk.red("🏭 Production") + chalk.gray(" (full pipeline)"),
              value: "prod",
              short: "Production",
            },
          ],
          default: "dev",
        })

        const spinner = ora({
          text: chalk.cyan(`Preparing ${environment} deployment...`),
          spinner: "dots12",
          color: "cyan",
        }).start()

        await new Promise((resolve) => setTimeout(resolve, 800))
        spinner.stop()

        if (environment === "dev") {
          console.log(chalk.green("✓"), chalk.bold("Deploying to Development"))
          await deployDev()
        } else {
          console.log(chalk.red("✓"), chalk.bold("Deploying to Production"))
          await deployProd()
        }
      } catch (error: any) {
        // Handle user cancellation gracefully
        if (
          error.name === "ExitPromptError" ||
          error.message?.includes("SIGINT")
        ) {
          console.log("\n")
          console.log(
            boxen(
              chalk.yellow("⚠️ ") + chalk.white("Deployment cancelled by user"),
              {
                padding: { top: 0, bottom: 0, left: 1, right: 1 },
                borderStyle: "round",
                borderColor: "yellow",
                backgroundColor: "#1a1a00",
              }
            )
          )
          return
        }
        // Re-throw other errors
        throw error
      }
    })

  deployCommand
    .command("dev")
    .description(chalk.gray("🔧 Quick development deploy"))
    .action(async (...args) => {
      const cmd = createEnhancedCommand(
        "deploy dev",
        "Deploying to dev",
        deployDev
      )
      await cmd.execute(...args)
    })

  deployCommand
    .command("prod")
    .description(chalk.gray("🏭 Production deployment"))
    .action(async (...args) => {
      const cmd = createEnhancedCommand(
        "deploy prod",
        "Deploying to prod",
        deployProd
      )
      await cmd.execute(...args)
    })

  // React Native commands
  const rnCommand = program
    .command("rn")
    .alias("react-native")
    .description(chalk.gray("📱 React Native tools"))

  rnCommand
    .command("build")
    .description(chalk.gray("🔨 Build React Native app"))
    .action(async () => {
      try {
        console.log(
          boxen(
            gradientString("green", "blue")("📱 React Native Build Center") +
              "\n" +
              chalk.gray("Choose your build target"),
            {
              padding: { top: 0, bottom: 0, left: 1, right: 1 },
              margin: { top: 1, bottom: 1, left: 0, right: 0 },
              borderStyle: "round",
              borderColor: "green",
              backgroundColor: "#0a1a0a",
            }
          )
        )

        const { buildType } = await inquirer.prompt({
          type: "list",
          name: "buildType",
          message: chalk.bold("🎯 Select build type:"),
          choices: [
            {
              name:
                chalk.green("🤖 Android Release") + chalk.gray(" (with clean)"),
              value: "android-release",
              short: "Android Release",
            },
            {
              name:
                chalk.green("🤖 Android Release") + chalk.gray(" (skip clean)"),
              value: "android-release-no-clean",
              short: "Android Release (No Clean)",
            },
            {
              name:
                chalk.yellow("🔧 Android Debug") + chalk.gray(" (with clean)"),
              value: "android-debug",
              short: "Android Debug",
            },
            {
              name:
                chalk.yellow("🔧 Android Debug") + chalk.gray(" (skip clean)"),
              value: "android-debug-no-clean",
              short: "Android Debug (No Clean)",
            },
            {
              name: chalk.gray("🍎 iOS Release") + chalk.gray(" (coming soon)"),
              value: "ios-release",
              disabled: "Coming soon",
            },
          ],
          default: "android-release",
        })

        if (buildType === "android-release") {
          await buildAndroidRelease()
        } else if (buildType === "android-release-no-clean") {
          await buildAndroidRelease(true)
        } else if (buildType === "android-debug") {
          await buildAndroidDebug()
        } else if (buildType === "android-debug-no-clean") {
          await buildAndroidDebug(true)
        }
      } catch (error: any) {
        // Handle user cancellation gracefully
        if (
          error.name === "ExitPromptError" ||
          error.message?.includes("SIGINT")
        ) {
          console.log("\n")
          console.log(
            boxen(
              chalk.yellow("⚠️ ") + chalk.white("Build cancelled by user"),
              {
                padding: { top: 0, bottom: 0, left: 1, right: 1 },
                borderStyle: "round",
                borderColor: "yellow",
                backgroundColor: "#1a1a00",
              }
            )
          )
          return
        }
        // Re-throw other errors
        throw error
      }
    })

  rnCommand
    .command("build release")
    .alias("br")
    .description(chalk.gray("🚀 Quick Android release build"))
    .action(async (...args) => {
      const cmd = createEnhancedCommand(
        "React Native build release",
        "Building Android release",
        buildAndroidRelease
      )
      await cmd.execute(...args)
    })

  rnCommand
    .command("build release --no-clean")
    .alias("brnc")
    .description(chalk.gray("🚀 Android release build (skip clean)"))
    .action(async (...args) => {
      const cmd = createEnhancedCommand(
        "React Native build release (no clean)",
        "Building Android release without clean",
        () => buildAndroidRelease(true)
      )
      await cmd.execute(...args)
    })

  rnCommand
    .command("build debug")
    .alias("bd")
    .description(chalk.gray("🔧 Android debug build"))
    .action(async (...args) => {
      const cmd = createEnhancedCommand(
        "React Native build debug",
        "Building Android debug",
        buildAndroidDebug
      )
      await cmd.execute(...args)
    })

  rnCommand
    .command("build debug --no-clean")
    .alias("bdnc")
    .description(chalk.gray("🔧 Android debug build (skip clean)"))
    .action(async (...args) => {
      const cmd = createEnhancedCommand(
        "React Native build debug (no clean)",
        "Building Android debug without clean",
        () => buildAndroidDebug(true)
      )
      await cmd.execute(...args)
    })

  // Spring Boot commands
  const sbCommand = program
    .command("sb")
    .alias("spring-boot")
    .description(chalk.gray("🍃 Spring Boot microservices tools"))

  sbCommand
    .command("start")
    .description(chalk.gray("🚀 Start all Spring Boot services in order"))
    .action(async (...args) => {
      const cmd = createEnhancedCommand(
        "Spring Boot start",
        "Starting microservices",
        startSpringBootServices
      )
      await cmd.execute(...args)
    })

  program
    .command("gen")
    .alias("g")
    .description(chalk.gray("⚡ Run all configured generators"))
    .action(async (...args) => {
      const cmd = createEnhancedCommand(
        "Generators",
        "Running all generators",
        gen
      )
      await cmd.execute(...args)
    })

  const gitCommand = program
    .command("git")
    .description(chalk.gray("🔧 Git configuration tools"))

  gitCommand
    .command("fix")
    .description(chalk.gray("🔧 Fix git core.ignorecase configuration"))
    .action(async (...args) => {
      const cmd = createEnhancedCommand(
        "Git configuration fix",
        "Fixing git ignorecase settings",
        gitFix
      )
      await cmd.execute(...args)
    })

  gitCommand
    .command("ac")
    .description(chalk.gray("📝 Add all changes and commit"))
    .action(async (...args) => {
      const cmd = createEnhancedCommand(
        "Git add & commit",
        "Staging and committing changes",
        gitAddCommit
      )
      await cmd.execute(...args)
    })

  gitCommand
    .command("acp")
    .description(chalk.gray("🚀 Add, commit, and push all changes"))
    .action(async (...args) => {
      const cmd = createEnhancedCommand(
        "Git add, commit & push",
        "Staging, committing, and pushing changes",
        gitAddCommitPush
      )
      await cmd.execute(...args)
    })

  // Database commands (only for node-express projects)
  const dbCommand = program
    .command("db")
    .description(chalk.gray("🗃️ Database management tools"))

  dbCommand
    .command("status")
    .description(chalk.gray("🔍 Check database connectivity"))
    .action(async (...args) => {
      const cmd = createEnhancedCommand(
        "Database status check",
        "Checking database connectivity",
        dbStatus
      )
      await cmd.execute(...args)
    })

  // Database dump commands
  const dumpCommand = dbCommand
    .command("dump")
    .description(chalk.gray("💾 Database backup operations"))

  dumpCommand
    .command("create")
    .description(chalk.gray("📦 Create database backup"))
    .action(async (...args) => {
      const cmd = createEnhancedCommand(
        "Database dump create",
        "Creating database backup",
        dbDumpCreate
      )
      await cmd.execute(...args)
    })

  dumpCommand
    .command("apply [version]")
    .description(chalk.gray("📥 Apply database dump"))
    .action(async (version, ...args) => {
      const cmd = createEnhancedCommand(
        "Database dump apply",
        "Applying database dump",
        dbDumpApply
      )
      await cmd.execute({ version }, ...args)
    })

  // Database drop commands
  const dropCommand = dbCommand
    .command("drop")
    .description(chalk.gray("🗑️ Database destructive operations"))

  dropCommand
    .command("all-tables")
    .description(chalk.gray("⚠️ Drop all tables (DANGEROUS)"))
    .option("--force", "Skip confirmation prompts (DANGEROUS)")
    .action(async (...args) => {
      const cmd = createEnhancedCommand(
        "Database drop all tables",
        "Dropping all database tables",
        dbDropAllTables
      )
      await cmd.execute(...args)
    })

  // Add help enhancement
  program.on("--help", () => {
    console.log("\n")
    console.log(
      boxen(
        gradientString("blue", "cyan")("💡 Pro Tips") +
          "\n" +
          chalk.gray("• Quick: ") +
          chalk.cyan("dk c") +
          chalk.gray(", ") +
          chalk.cyan("dk dr") +
          "\n" +
          chalk.gray("• Deploy: ") +
          chalk.cyan("dk d dev") +
          "\n" +
          chalk.gray("• RN Release: ") +
          chalk.cyan("dk rn br") +
          "\n" +
          chalk.gray("• RN Debug: ") +
          chalk.cyan("dk rn bd") +
          "\n" +
          chalk.gray("• No Clean: ") +
          chalk.cyan("dk rn brnc") +
          "\n" +
          chalk.gray("• Spring Boot: ") +
          chalk.cyan("dk sb start") +
          "\n" +
          chalk.gray("• Generators: ") +
          chalk.cyan("dk gen") +
          "\n" +
          chalk.gray("• Git Fix: ") +
          chalk.cyan("dk git fix") +
          "\n" +
          chalk.gray("• Git Add & Commit: ") +
          chalk.cyan("dk git ac") +
          "\n" +
          chalk.gray("• Git Add, Commit & Push: ") +
          chalk.cyan("dk git acp") +
          "\n" +
          chalk.gray("• DB Status: ") +
          chalk.cyan("dk db status") +
          "\n" +
          chalk.gray("• DB Dump: ") +
          chalk.cyan("dk db dump create") +
          "\n" +
          chalk.gray("• Help: ") +
          chalk.cyan("dk --help"),
        {
          padding: { top: 0, bottom: 0, left: 1, right: 1 },
          borderStyle: "round",
          borderColor: "blue",
          backgroundColor: "#0a0a1a",
        }
      )
    )
  })

  program.parse(process.argv)

  // Show help if no command provided
  if (!process.argv.slice(2).length) {
    console.log(
      boxen(
        chalk.blue("ℹ️ ") +
          chalk.white("Run ") +
          chalk.cyan("dk --help") +
          chalk.white(" for commands"),
        {
          padding: { top: 0, bottom: 0, left: 1, right: 1 },
          margin: { top: 1, bottom: 0, left: 0, right: 0 },
          borderStyle: "round",
          borderColor: "blue",
          backgroundColor: "#0a0a1a",
        }
      )
    )
  }
}

// Run the main function
main().catch(console.error)
