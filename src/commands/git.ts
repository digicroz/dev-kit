import { ui } from "../utils/ui-helpers.js"
import { spawn } from "child_process"
import inquirer from "inquirer"

type GitConfigScope = "local" | "global" | "both"

const runGitCommand = (
  args: string[],
  cwd?: string
): Promise<{ success: boolean; output: string; error?: string }> => {
  return new Promise((resolve) => {
    const child = spawn("git", args, {
      cwd: cwd || process.cwd(),
      stdio: ["pipe", "pipe", "pipe"],
      shell: true,
    })

    let stdout = ""
    let stderr = ""

    child.stdout?.on("data", (data) => {
      stdout += data.toString()
    })

    child.stderr?.on("data", (data) => {
      stderr += data.toString()
    })

    child.on("close", (code) => {
      resolve({
        success: code === 0,
        output: stdout.trim(),
        error: stderr.trim(),
      })
    })

    child.on("error", (error) => {
      resolve({
        success: false,
        output: "",
        error: error.message,
      })
    })
  })
}

const setIgnoreCase = async (scope: "local" | "global"): Promise<boolean> => {
  const args = ["config"]
  if (scope === "global") {
    args.push("--global")
  }
  args.push("core.ignorecase", "false")

  const result = await runGitCommand(args)
  return result.success
}

const checkIgnoreCase = async (
  scope: "local" | "global"
): Promise<string | null> => {
  const args = ["config"]
  if (scope === "global") {
    args.push("--global")
  }
  args.push("core.ignorecase")

  const result = await runGitCommand(args)
  return result.success ? result.output : null
}

export const gitFix = async () => {
  ui.section("🔧 Git Configuration Fix", "Setting core.ignorecase to false")

  // Check if we're in a git repository for local config
  const gitStatusResult = await runGitCommand(["status", "--porcelain"])
  const isGitRepo = gitStatusResult.success

  if (!isGitRepo) {
    ui.warning(
      "Not in a git repository",
      "Local configuration will be skipped."
    )
  }

  // Get current configurations
  const spinner = ui.createSpinner("Checking current git configuration...")
  spinner.start()

  const currentLocal = isGitRepo ? await checkIgnoreCase("local") : null
  const currentGlobal = await checkIgnoreCase("global")

  spinner.stop()

  // Show current status
  ui.info("Current git configuration:\n")
  console.log(`  🌐 Global core.ignorecase: ${currentGlobal || "not set"}`)
  if (isGitRepo) {
    console.log(`  📁 Local core.ignorecase:  ${currentLocal || "not set"}`)
  }
  console.log("")

  // Determine what needs to be fixed
  const needsGlobalFix = currentGlobal !== "false"
  const needsLocalFix = isGitRepo && currentLocal !== "false"

  if (!needsGlobalFix && !needsLocalFix) {
    ui.success(
      "No fixes needed!",
      "core.ignorecase is already set to false for all applicable scopes."
    )
    return { ok: true, applied: [] }
  }

  // Ask user what to fix
  const choices: Array<{
    name: string
    value: GitConfigScope
    checked?: boolean
  }> = []

  if (needsGlobalFix) {
    choices.push({
      name: "🌐 Global (affects all repositories)",
      value: "global",
      checked: true,
    })
  }

  if (needsLocalFix) {
    choices.push({
      name: "📁 Local (current repository only)",
      value: "local",
      checked: true,
    })
  }

  if (choices.length > 1) {
    choices.push({
      name: "🎯 Both global and local",
      value: "both",
      checked: false,
    })
  }

  let scopesToFix: GitConfigScope[]

  if (choices.length === 1) {
    // Only one option available, ask for confirmation
    const { proceed } = await inquirer.prompt({
      type: "confirm",
      name: "proceed",
      message: `Fix ${choices[0].value} git configuration?`,
      default: true,
    })

    if (!proceed) {
      ui.info("Cancelled.")
      return { ok: false, cancelled: true }
    }

    scopesToFix = [choices[0].value]
  } else {
    // Multiple options, let user choose
    const { scope } = await inquirer.prompt({
      type: "list",
      name: "scope",
      message: "Which configuration would you like to fix?",
      choices,
      default: "both",
    })

    if (scope === "both") {
      scopesToFix = ["global", "local"]
    } else {
      scopesToFix = [scope]
    }
  }

  // Apply the fixes
  const fixSpinner = ui.createSpinner("Applying git configuration fixes...")
  fixSpinner.start()

  const applied: string[] = []
  const failed: string[] = []

  for (const scope of scopesToFix) {
    if (scope === "both") continue // This is handled by having both global and local in the array

    if (scope === "local" && !isGitRepo) {
      failed.push(`${scope} (not in git repository)`)
      continue
    }

    const success = await setIgnoreCase(scope)
    if (success) {
      applied.push(scope)
    } else {
      failed.push(scope)
    }
  }

  fixSpinner.stop()

  // Show results
  if (applied.length > 0) {
    ui.success(
      "Git configuration fixed!",
      `core.ignorecase set to false for: ${applied.join(", ")}`
    )
  }

  if (failed.length > 0) {
    ui.error(
      "Some fixes failed",
      `Failed to set configuration for: ${failed.join(", ")}`
    )
  }

  // Show final status
  console.log("")
  ui.info("Updated git configuration:\n")

  const finalGlobal = await checkIgnoreCase("global")
  const finalLocal = isGitRepo ? await checkIgnoreCase("local") : null

  console.log(`  🌐 Global core.ignorecase: ${finalGlobal || "not set"}`)
  if (isGitRepo) {
    console.log(`  📁 Local core.ignorecase:  ${finalLocal || "not set"}`)
  }

  ui.table([
    { key: "Scopes fixed", value: applied.length.toString() },
    { key: "Failed fixes", value: failed.length.toString() },
    { key: "Global setting", value: finalGlobal || "not set" },
    {
      key: "Local setting",
      value: isGitRepo ? finalLocal || "not set" : "N/A",
    },
  ])

  return {
    ok: applied.length > 0,
    applied,
    failed,
    stats: {
      scopesFixed: applied.length,
      failed: failed.length,
      isGitRepo,
    },
  }
}
