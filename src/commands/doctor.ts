import chalk from "chalk"
import { execSync } from "child_process"
import { existsSync, readFileSync } from "fs"
import { dirname, join } from "path"
import { fileURLToPath } from "url"
import { ui } from "../utils/ui-helpers.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

interface HealthCheck {
  name: string
  status: "pass" | "fail" | "warn"
  message: string
}

export async function doctor(): Promise<void> {
  ui.section(
    "🩺 DK Health Diagnostics",
    "Comprehensive system and configuration check"
  )

  const diagnosticSpinner = ui.createSpinner("Running diagnostic tests...")
  diagnosticSpinner.start()

  await new Promise((resolve) => setTimeout(resolve, 800)) // Brief pause for UX

  const checks: HealthCheck[] = []

  // Check DK installation
  try {
    const packageJsonPath = join(__dirname, "../../package.json")
    if (existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"))
      checks.push({
        name: "DK Installation",
        status: "pass",
        message: `DK v${packageJson.version} is installed correctly`,
      })
    } else {
      checks.push({
        name: "DK Installation",
        status: "fail",
        message: "DK package files not found",
      })
    }
  } catch (error) {
    checks.push({
      name: "DK Installation",
      status: "fail",
      message: "DK installation appears corrupted",
    })
  }

  // Check Node.js version compatibility
  try {
    const nodeVersion = process.version
    const majorVersion = parseInt(nodeVersion.slice(1).split(".")[0])

    if (majorVersion >= 18) {
      checks.push({
        name: "Node.js Compatibility",
        status: "pass",
        message: `Node.js ${nodeVersion} is compatible`,
      })
    } else if (majorVersion >= 16) {
      checks.push({
        name: "Node.js Compatibility",
        status: "warn",
        message: `Node.js ${nodeVersion} works but v18+ recommended`,
      })
    } else {
      checks.push({
        name: "Node.js Compatibility",
        status: "fail",
        message: `Node.js ${nodeVersion} is too old (minimum v16 required)`,
      })
    }
  } catch (error) {
    checks.push({
      name: "Node.js Compatibility",
      status: "fail",
      message: "Unable to detect Node.js version",
    })
  }

  // Check npm availability (required for some DK features)
  try {
    execSync("npm --version", { stdio: "pipe" })
    const npmVersion = execSync("npm --version", { encoding: "utf8" }).trim()
    checks.push({
      name: "npm Availability",
      status: "pass",
      message: `npm v${npmVersion} is available`,
    })
  } catch (error) {
    checks.push({
      name: "npm Availability",
      status: "fail",
      message: "npm not found (required for some DK features)",
    })
  }

  // Check git availability (required for deploy commands)
  try {
    execSync("git --version", { stdio: "pipe" })
    const gitVersion = execSync("git --version", { encoding: "utf8" }).trim()
    checks.push({
      name: "Git for Deploy Commands",
      status: "pass",
      message: `${gitVersion} is available`,
    })
  } catch (error) {
    checks.push({
      name: "Git for Deploy Commands",
      status: "warn",
      message: "Git not found (deploy commands will not work)",
    })
  }

  // Check if current directory is a project (has package.json)
  const currentDir = process.cwd()
  const projectPackageJson = join(currentDir, "package.json")

  if (existsSync(projectPackageJson)) {
    try {
      const projectPkg = JSON.parse(readFileSync(projectPackageJson, "utf8"))
      checks.push({
        name: "Current Project",
        status: "pass",
        message: `Working in project: ${projectPkg.name || "unnamed project"}`,
      })
    } catch (error) {
      checks.push({
        name: "Current Project",
        status: "warn",
        message: "package.json found but invalid format",
      })
    }
  } else {
    checks.push({
      name: "Current Project",
      status: "warn",
      message:
        "Not in a Node.js project directory (some features may be limited)",
    })
  }

  // Check if we're in a git repository (for deploy commands)
  try {
    execSync("git rev-parse --git-dir", { stdio: "pipe", cwd: currentDir })
    checks.push({
      name: "Git Repository Status",
      status: "pass",
      message:
        "Current directory is a git repository (deploy commands available)",
    })
  } catch (error) {
    checks.push({
      name: "Git Repository Status",
      status: "warn",
      message: "Not in a git repository (deploy commands will not work here)",
    })
  }

  // Test basic DK commands availability
  try {
    // Check if DK commands are accessible (basic smoke test)
    const dkCommands = ["clean", "deploy"]
    const commandsPath = join(__dirname, "../commands")
    const availableCommands = dkCommands.filter(
      (cmd) =>
        existsSync(join(commandsPath, `${cmd}.js`)) ||
        existsSync(join(commandsPath, `${cmd}.ts`))
    )

    if (availableCommands.length === dkCommands.length) {
      checks.push({
        name: "DK Commands",
        status: "pass",
        message: "All DK commands are available",
      })
    } else {
      checks.push({
        name: "DK Commands",
        status: "fail",
        message: `Some DK commands are missing: ${dkCommands
          .filter((cmd) => !availableCommands.includes(cmd))
          .join(", ")}`,
      })
    }
  } catch (error) {
    checks.push({
      name: "DK Commands",
      status: "fail",
      message: "Unable to verify DK commands availability",
    })
  }

  // Display results
  diagnosticSpinner.stop()

  ui.info(
    "Diagnostic Results:",
    "Analysis of your DK installation and environment"
  )
  console.log("")

  let hasErrors = false
  let hasWarnings = false
  let passCount = 0

  checks.forEach((check) => {
    const icons = {
      pass: chalk.green("✓"),
      warn: chalk.yellow("⚠"),
      fail: chalk.red("✗"),
    }

    const colors = {
      pass: chalk.green,
      warn: chalk.yellow,
      fail: chalk.red,
    }

    console.log(`  ${icons[check.status]} ${chalk.bold(check.name)}`)
    console.log(`    ${colors[check.status](check.message)}`)
    console.log("")

    if (check.status === "fail") hasErrors = true
    if (check.status === "warn") hasWarnings = true
    if (check.status === "pass") passCount++
  })

  // Beautiful summary with progress visualization
  ui.section("📊 Health Summary", "Overall system status and recommendations")

  console.log("Health Score: " + ui.progressBar(passCount, checks.length, 25))
  console.log("")

  ui.table([
    { key: "Total Checks", value: checks.length.toString() },
    { key: "Passed", value: chalk.green(passCount.toString()) },
    {
      key: "Warnings",
      value: chalk.yellow(
        checks.filter((c) => c.status === "warn").length.toString()
      ),
    },
    {
      key: "Failures",
      value: chalk.red(
        checks.filter((c) => c.status === "fail").length.toString()
      ),
    },
  ])

  console.log("")

  // Enhanced status messages with beautiful styling
  if (!hasErrors && !hasWarnings) {
    ui.confirmBox(
      "🎉 DK is working perfectly! All features are ready to use.",
      "success"
    )
    console.log(chalk.green("You can now use all DK commands:"))
    console.log(
      chalk.gray("  • ") +
        chalk.cyan("dk clean  ") +
        chalk.gray("- Clean temporary files")
    )
    console.log(
      chalk.gray("  • ") +
        chalk.cyan("dk deploy ") +
        chalk.gray("- Deploy your project")
    )
  } else if (!hasErrors && hasWarnings) {
    ui.confirmBox(
      "⚠️ DK is working but some features may be limited.",
      "warning"
    )
    console.log(
      chalk.yellow("Review the warnings above to enable all features.")
    )
  } else {
    ui.confirmBox("❌ DK has installation issues that need attention.", "error")
    console.log(chalk.red("Please fix the errors above or reinstall DK:"))
    console.log(
      chalk.gray("  ") + chalk.cyan("npm install -g @digicroz/dev-kit")
    )
  }

  // Help information in a beautiful box
  console.log("\n")
  ui.confirmBox(
    "💡 Need Help?\n\n" +
      "📖 Documentation: https://github.com/digicroz/dev-kit\n" +
      "🐛 Report Issues: https://github.com/digicroz/dev-kit/issues\n" +
      "💬 Community Support: Join our discussions",
    "info"
  )
}
