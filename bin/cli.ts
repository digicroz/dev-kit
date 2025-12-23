import { Command } from "commander";
import chalk from "chalk";
import inquirer from "inquirer";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import boxen from "boxen";
import gradientString from "gradient-string";
import ora from "ora";

import { clean } from "../src/commands/clean.js";
import { deployDev, deployProd } from "../src/commands/deploy.js";
import { doctor } from "../src/commands/doctor.js";
import {
  buildAndroidRelease,
  buildAndroidDebug,
} from "../src/commands/reactNative.js";
import { ui } from "../src/utils/ui-helpers.js";
import {
  configExists,
  readConfig,
  isConfigOutdated,
} from "../src/utils/config.js";
import { init as runInit } from "../src/commands/init.js";
import { updateConfig } from "../src/commands/config.js";
import { startSpringBootServices } from "../src/commands/springBoot.js";
import { gen } from "../src/commands/gen.js";
import {
  gitFix,
  gitAddCommit,
  gitAddCommitPush,
  gitAutoCommit,
} from "../src/commands/git.js";
import {
  dbStatus,
  dbDumpCreate,
  dbDumpApply,
  dbDropAllTables,
} from "../src/commands/database.js";

// Get package.json version
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(
  readFileSync(join(__dirname, "../package.json"), "utf8")
);
const version = packageJson.version;

// Beautiful animated welcome banner
async function showWelcomeBanner() {
  console.clear();

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
  );

  console.log(welcomeMessage);
}

// Helper function to create styled boxen messages
function createBox(
  message: string,
  color: string,
  backgroundColor: string = "#0a0a1a"
) {
  return boxen(message, {
    padding: { top: 0, bottom: 0, left: 1, right: 1 },
    margin: { top: 1, bottom: 1, left: 0, right: 0 },
    borderStyle: "round",
    borderColor: color,
    backgroundColor,
  });
}

// Show project mode required error
function showProjectModeRequired() {
  console.log("\n");
  console.log(
    createBox(
      chalk.red("⚠️ Project Mode Required") +
        "\n" +
        chalk.gray("This command requires dk.config.json") +
        "\n" +
        chalk.cyan("Run 'dk init' to create project configuration"),
      "red",
      "#1a0000"
    )
  );
  process.exit(1);
}

// Handle user cancellation gracefully
function handleCancellation(commandName: string) {
  console.log("\n");
  console.log(
    createBox(
      chalk.yellow("⚠️ ") + chalk.white(`${commandName} cancelled by user`),
      "yellow",
      "#1a1a00"
    )
  );
}

// Check if error is user cancellation
function isCancellationError(error: any): boolean {
  return error.name === "ExitPromptError" || error.message?.includes("SIGINT");
}

// Enhanced command wrapper with loading animation
function createEnhancedCommand(
  name: string,
  description: string,
  action: Function,
  requiresProject: boolean = false
) {
  return {
    name,
    description: chalk.gray(description),
    async execute(...args: any[]) {
      // Check if command requires project mode
      if (requiresProject && !configExists()) {
        showProjectModeRequired();
      }

      const spinner = ora({
        text: chalk.cyan(`Executing ${name}...`),
        spinner: "dots12",
        color: "cyan",
      }).start();

      try {
        await new Promise((resolve) => setTimeout(resolve, 300)); // Brief delay for UX
        spinner.stop();
        console.log(chalk.green("✓"), chalk.bold(`${name} ready`));
        await action(...args);
      } catch (error: any) {
        spinner.stop();

        // Handle user cancellation gracefully
        if (isCancellationError(error)) {
          handleCancellation(name);
          return;
        }

        // Handle other errors
        spinner.fail(chalk.red(`Failed to execute ${name}`));
        console.error(chalk.red("Error:"), error);
        process.exit(1);
      }
    },
  };
}

// Enhanced error handling and beautiful exit
process.on("SIGINT", () => {
  // Only handle SIGINT if we're not in the middle of a prompt
  if (!process.stdin.isTTY || process.stdin.readableEnded) {
    console.log("\n");
    console.log(
      gradientString(
        "yellow",
        "orange"
      )("👋 Thanks for using DK! See you soon! ✨")
    );
    process.exit(0);
  }
});

process.on("uncaughtException", (error) => {
  console.log("\n");
  console.log(
    createBox(
      chalk.red("💥 Error: ") + chalk.white(error.message),
      "red",
      "#1a0000"
    )
  );
  process.exit(1);
});

// Main execution function
async function main() {
  // Register config upgrade command
  const program = new Command();

  // Detect mode: Project Mode or Standalone Mode
  const projectMode = configExists();
  const mode = projectMode ? "Project Mode" : "Standalone Mode";

  const configCmd = program
    .command("config")
    .description(chalk.gray("Manage dk.config.json"));

  configCmd
    .command("update")
    .description(chalk.gray("Update dk.config.json to latest version"))
    .action(async () => {
      await updateConfig();
    });
  // Show banner only at the start
  await showWelcomeBanner();

  // Display current mode
  const modeColor = projectMode ? "green" : "yellow";
  const modeIcon = projectMode ? "📁" : "⚡";
  console.log(
    createBox(
      chalk[modeColor](`${modeIcon} ${mode}`) +
        "\n" +
        chalk.gray(
          projectMode
            ? "Running with project configuration"
            : "Running in standalone mode - some commands require 'dk init'"
        ),
      modeColor,
      projectMode ? "#0a1a0a" : "#1a1a00"
    )
  );

  // Check config version and warn if outdated (only in project mode)
  if (projectMode) {
    const config = readConfig();
    if (isConfigOutdated(config)) {
      ui.warning(
        "Your dk.config.json is outdated.",
        "Run 'dk config update' to update your config file."
      );
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
    });

  program
    .command("init")
    .alias("i")
    .description(chalk.gray("🚀 Initialize dk.config.json"))
    .action(async (...args) => {
      const cmd = createEnhancedCommand(
        "init",
        "Initializing configuration",
        runInit
      );
      await cmd.execute(...args);
    });

  program
    .command("clean")
    .alias("c")
    .description(chalk.gray("🧹 Clean temporary files"))
    .action(async (...args) => {
      const cmd = createEnhancedCommand(
        "clean",
        "Cleaning project",
        clean,
        true
      );
      await cmd.execute(...args);
    });

  program
    .command("doctor")
    .alias("dr")
    .description(chalk.gray("🩺 System health check"))
    .action(async (...args) => {
      const cmd = createEnhancedCommand(
        "doctor",
        "Running diagnostics",
        doctor
      );
      await cmd.execute(...args);
    });

  // Enhanced Deploy command with beautiful UI
  const deployCommand = program
    .command("deploy")
    .alias("d")
    .description(chalk.gray("🚀 Deploy with confidence"))
    .action(async () => {
      if (!configExists()) {
        showProjectModeRequired();
      }

      try {
        console.log(
          createBox(
            gradientString("magenta", "cyan")("🚀 Deployment Center") +
              "\n" +
              chalk.gray("Choose your destination"),
            "magenta",
            "#0a0a1a"
          )
        );

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
        });

        const spinner = ora({
          text: chalk.cyan(`Preparing ${environment} deployment...`),
          spinner: "dots12",
          color: "cyan",
        }).start();

        await new Promise((resolve) => setTimeout(resolve, 800));
        spinner.stop();

        if (environment === "dev") {
          console.log(chalk.green("✓"), chalk.bold("Deploying to Development"));
          await deployDev();
        } else {
          console.log(chalk.red("✓"), chalk.bold("Deploying to Production"));
          await deployProd();
        }
      } catch (error: any) {
        if (isCancellationError(error)) {
          handleCancellation("Deployment");
          return;
        }
        throw error;
      }
    });

  deployCommand
    .command("dev")
    .description(chalk.gray("🔧 Quick development deploy"))
    .action(async (...args) => {
      const cmd = createEnhancedCommand(
        "deploy dev",
        "Deploying to dev",
        deployDev,
        true
      );
      await cmd.execute(...args);
    });

  deployCommand
    .command("prod")
    .description(chalk.gray("🏭 Production deployment"))
    .action(async (...args) => {
      const cmd = createEnhancedCommand(
        "deploy prod",
        "Deploying to prod",
        deployProd,
        true
      );
      await cmd.execute(...args);
    });

  // React Native commands
  const rnCommand = program
    .command("rn")
    .alias("react-native")
    .description(chalk.gray("📱 React Native tools"));

  rnCommand
    .command("build")
    .description(chalk.gray("🔨 Build React Native app"))
    .action(async () => {
      if (!configExists()) {
        showProjectModeRequired();
      }

      try {
        console.log(
          createBox(
            gradientString("green", "blue")("📱 React Native Build Center") +
              "\n" +
              chalk.gray("Choose your build target"),
            "green",
            "#0a1a0a"
          )
        );

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
        });

        if (buildType === "android-release") {
          await buildAndroidRelease();
        } else if (buildType === "android-release-no-clean") {
          await buildAndroidRelease(true);
        } else if (buildType === "android-debug") {
          await buildAndroidDebug();
        } else if (buildType === "android-debug-no-clean") {
          await buildAndroidDebug(true);
        }
      } catch (error: any) {
        if (isCancellationError(error)) {
          handleCancellation("Build");
          return;
        }
        throw error;
      }
    });

  rnCommand
    .command("build release")
    .alias("br")
    .description(chalk.gray("🚀 Quick Android release build"))
    .action(async (...args) => {
      const cmd = createEnhancedCommand(
        "React Native build release",
        "Building Android release",
        buildAndroidRelease,
        true
      );
      await cmd.execute(...args);
    });

  rnCommand
    .command("build release --no-clean")
    .alias("brnc")
    .description(chalk.gray("🚀 Android release build (skip clean)"))
    .action(async (...args) => {
      const cmd = createEnhancedCommand(
        "React Native build release (no clean)",
        "Building Android release without clean",
        () => buildAndroidRelease(true),
        true
      );
      await cmd.execute(...args);
    });

  rnCommand
    .command("build debug")
    .alias("bd")
    .description(chalk.gray("🔧 Android debug build"))
    .action(async (...args) => {
      const cmd = createEnhancedCommand(
        "React Native build debug",
        "Building Android debug",
        buildAndroidDebug,
        true
      );
      await cmd.execute(...args);
    });

  rnCommand
    .command("build debug --no-clean")
    .alias("bdnc")
    .description(chalk.gray("🔧 Android debug build (skip clean)"))
    .action(async (...args) => {
      const cmd = createEnhancedCommand(
        "React Native build debug (no clean)",
        "Building Android debug without clean",
        () => buildAndroidDebug(true),
        true
      );
      await cmd.execute(...args);
    });

  // Spring Boot commands
  const sbCommand = program
    .command("sb")
    .alias("spring-boot")
    .description(chalk.gray("🍃 Spring Boot microservices tools"));

  sbCommand
    .command("start")
    .description(chalk.gray("🚀 Start all Spring Boot services in order"))
    .action(async (...args) => {
      const cmd = createEnhancedCommand(
        "Spring Boot start",
        "Starting microservices",
        startSpringBootServices,
        true
      );
      await cmd.execute(...args);
    });

  program
    .command("gen")
    .alias("g")
    .description(chalk.gray("⚡ Run all configured generators"))
    .action(async (...args) => {
      const cmd = createEnhancedCommand(
        "Generators",
        "Running all generators",
        gen,
        true
      );
      await cmd.execute(...args);
    });

  program
    .command("commit")
    .description(chalk.gray("🔄 Auto-commit project-specific files"))
    .action(async (...args) => {
      const cmd = createEnhancedCommand(
        "Git auto commit",
        "Committing project-specific files",
        gitAutoCommit,
        true
      );
      await cmd.execute(...args);
    });

  const gitCommand = program
    .command("git")
    .description(chalk.gray("🔧 Git configuration tools"));

  gitCommand
    .command("fix")
    .description(chalk.gray("🔧 Fix git core.ignorecase configuration"))
    .action(async (...args) => {
      const cmd = createEnhancedCommand(
        "Git configuration fix",
        "Fixing git ignorecase settings",
        gitFix
      );
      await cmd.execute(...args);
    });

  gitCommand
    .command("ac")
    .description(chalk.gray("📝 Add all changes and commit"))
    .action(async (...args) => {
      const cmd = createEnhancedCommand(
        "Git add & commit",
        "Staging and committing changes",
        gitAddCommit
      );
      await cmd.execute(...args);
    });

  gitCommand
    .command("acp")
    .description(chalk.gray("🚀 Add, commit, and push all changes"))
    .action(async (...args) => {
      const cmd = createEnhancedCommand(
        "Git add, commit & push",
        "Staging, committing, and pushing changes",
        gitAddCommitPush
      );
      await cmd.execute(...args);
    });

  gitCommand
    .command("commit")
    .description(chalk.gray("🔄 Auto-commit project-specific files"))
    .action(async (...args) => {
      const cmd = createEnhancedCommand(
        "Git auto commit",
        "Committing project-specific files",
        gitAutoCommit,
        true
      );
      await cmd.execute(...args);
    });

  // Database commands (only for node-express projects)
  const dbCommand = program
    .command("db")
    .description(chalk.gray("🗃️ Database management tools"));

  dbCommand
    .command("status")
    .description(chalk.gray("🔍 Check database connectivity"))
    .action(async (...args) => {
      const cmd = createEnhancedCommand(
        "Database status check",
        "Checking database connectivity",
        dbStatus,
        true
      );
      await cmd.execute(...args);
    });

  // Database dump commands
  const dumpCommand = dbCommand
    .command("dump")
    .description(chalk.gray("💾 Database backup operations"));

  dumpCommand
    .command("create")
    .description(chalk.gray("📦 Create database backup"))
    .action(async (...args) => {
      const cmd = createEnhancedCommand(
        "Database dump create",
        "Creating database backup",
        dbDumpCreate,
        true
      );
      await cmd.execute(...args);
    });

  dumpCommand
    .command("apply [version]")
    .description(chalk.gray("📥 Apply database dump"))
    .action(async (version, ...args) => {
      const cmd = createEnhancedCommand(
        "Database dump apply",
        "Applying database dump",
        dbDumpApply,
        true
      );
      await cmd.execute({ version }, ...args);
    });

  // Database drop commands
  const dropCommand = dbCommand
    .command("drop")
    .description(chalk.gray("🗑️ Database destructive operations"));

  dropCommand
    .command("all-tables")
    .description(chalk.gray("⚠️ Drop all tables (DANGEROUS)"))
    .option("--force", "Skip confirmation prompts (DANGEROUS)")
    .action(async (...args) => {
      const cmd = createEnhancedCommand(
        "Database drop all tables",
        "Dropping all database tables",
        dbDropAllTables,
        true
      );
      await cmd.execute(...args);
    });

  // Add help enhancement
  program.on("--help", () => {
    console.log("\n");
    console.log(
      createBox(
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
        "blue"
      )
    );
  });

  // Show interactive menu if no command provided
  if (!process.argv.slice(2).length) {
    await showInteractiveMenu(projectMode);
    return;
  }

  program.parse(process.argv);
}

// Interactive menu when no command is provided
async function showInteractiveMenu(projectMode: boolean) {
  const standaloneCommands = [
    {
      name: "1. 🚀 Init - Initialize project configuration",
      value: "init",
      command: "init",
    },
    {
      name: "2. 🩺 Doctor - System health check",
      value: "doctor",
      command: "doctor",
    },
    {
      name: "3. 🔧 Git Fix - Fix git configuration",
      value: "git:fix",
      command: "git fix",
    },
    {
      name: "4. 📝 Git Add & Commit - Stage and commit",
      value: "git:ac",
      command: "git ac",
    },
    {
      name: "5. 🚀 Git Add, Commit & Push",
      value: "git:acp",
      command: "git acp",
    },
    {
      name: "6. ❓ Help - Show all commands",
      value: "help",
      command: "--help",
    },
    { name: "7. ❌ Exit", value: "exit", command: null },
  ];

  const projectCommands = [
    {
      name: "1. 🧹 Clean - Clean temporary files",
      value: "clean",
      command: "clean",
    },
    {
      name: "2. 🚀 Deploy - Deploy application",
      value: "deploy",
      command: "deploy",
    },
    {
      name: "3. 📱 React Native Build",
      value: "rn:build",
      command: "rn build",
    },
    {
      name: "4. 🍃 Spring Boot - Start services",
      value: "sb:start",
      command: "sb start",
    },
    { name: "5. ⚡ Generators - Run generators", value: "gen", command: "gen" },
    {
      name: "6. 🔄 Commit - Auto-commit files",
      value: "commit",
      command: "commit",
    },
    { name: "7. 🗃️ Database Status", value: "db:status", command: "db status" },
    {
      name: "8. 💾 Database Dump",
      value: "db:dump",
      command: "db dump create",
    },
    {
      name: "9. 🩺 Doctor - System health check",
      value: "doctor",
      command: "doctor",
    },
    { name: "10. 📝 Git Add & Commit", value: "git:ac", command: "git ac" },
    {
      name: "11. 🚀 Git Add, Commit & Push",
      value: "git:acp",
      command: "git acp",
    },
    {
      name: "12. ❓ Help - Show all commands",
      value: "help",
      command: "--help",
    },
    { name: "13. ❌ Exit", value: "exit", command: null },
  ];

  const choices = projectMode ? projectCommands : standaloneCommands;

  try {
    const { selectedCommand } = await inquirer.prompt({
      type: "list",
      name: "selectedCommand",
      message: chalk.bold("🎯 Select a command to run:"),
      choices,
      pageSize: 15,
      loop: false,
    });

    if (selectedCommand === "exit") {
      console.log(
        gradientString(
          "yellow",
          "orange"
        )("👋 Thanks for using DK! See you soon! ✨")
      );
      process.exit(0);
    }

    const selected = choices.find((c) => c.value === selectedCommand);
    if (selected && selected.command) {
      console.log(chalk.cyan(`\n▶ Running: dk ${selected.command}\n`));
      await executeCommand(selected.command, projectMode);
    }
  } catch (error: any) {
    if (isCancellationError(error)) {
      console.log(
        gradientString(
          "yellow",
          "orange"
        )("\n👋 Thanks for using DK! See you soon! ✨")
      );
      process.exit(0);
    }
    throw error;
  }
}

// Execute the selected command directly
async function executeCommand(commandStr: string, projectMode: boolean) {
  const parts = commandStr.split(" ");
  const mainCmd = parts[0];
  const subCmd = parts[1];

  switch (mainCmd) {
    case "init":
      await runInit();
      break;
    case "clean":
      if (!projectMode) showProjectModeRequired();
      await clean();
      break;
    case "doctor":
      await doctor();
      break;
    case "deploy":
      if (!projectMode) showProjectModeRequired();
      // Show deploy menu
      const { environment } = await inquirer.prompt({
        type: "list",
        name: "environment",
        message: chalk.bold("🎯 Select environment:"),
        choices: [
          {
            name: chalk.green("🔧 Development") + chalk.gray(" (quick deploy)"),
            value: "dev",
          },
          {
            name: chalk.red("🏭 Production") + chalk.gray(" (full pipeline)"),
            value: "prod",
          },
        ],
      });
      if (environment === "dev") await deployDev();
      else await deployProd();
      break;
    case "rn":
      if (!projectMode) showProjectModeRequired();
      // Show RN build menu
      const { buildType } = await inquirer.prompt({
        type: "list",
        name: "buildType",
        message: chalk.bold("🎯 Select build type:"),
        choices: [
          {
            name: chalk.green("🤖 Android Release (with clean)"),
            value: "release",
          },
          {
            name: chalk.green("🤖 Android Release (skip clean)"),
            value: "release-nc",
          },
          {
            name: chalk.yellow("🔧 Android Debug (with clean)"),
            value: "debug",
          },
          {
            name: chalk.yellow("🔧 Android Debug (skip clean)"),
            value: "debug-nc",
          },
        ],
      });
      if (buildType === "release") await buildAndroidRelease();
      else if (buildType === "release-nc") await buildAndroidRelease(true);
      else if (buildType === "debug") await buildAndroidDebug();
      else if (buildType === "debug-nc") await buildAndroidDebug(true);
      break;
    case "sb":
      if (!projectMode) showProjectModeRequired();
      await startSpringBootServices();
      break;
    case "gen":
      if (!projectMode) showProjectModeRequired();
      await gen();
      break;
    case "commit":
      if (!projectMode) showProjectModeRequired();
      await gitAutoCommit();
      break;
    case "git":
      if (subCmd === "fix") await gitFix();
      else if (subCmd === "ac") await gitAddCommit();
      else if (subCmd === "acp") await gitAddCommitPush();
      break;
    case "db":
      if (!projectMode) showProjectModeRequired();
      if (subCmd === "status") await dbStatus();
      else if (parts[1] === "dump" && parts[2] === "create")
        await dbDumpCreate();
      break;
    case "--help":
      process.argv = ["node", "dk", "--help"];
      await main();
      break;
  }
}

// Run the main function
main().catch(console.error);
