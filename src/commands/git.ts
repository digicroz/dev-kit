import { ui } from "../utils/ui-helpers.js"
import { spawn } from "child_process"
import inquirer from "inquirer"
import chalk from "chalk"

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

export const gitAddCommit = async () => {
  ui.section("📝 Git Add & Commit", "Stage all changes and commit")

  const gitStatusResult = await runGitCommand(["status", "--porcelain"])
  const isGitRepo = gitStatusResult.success

  if (!isGitRepo) {
    ui.error("Not in a git repository", "Please run this command from a git repository.")
    return { ok: false, error: "not_git_repo" }
  }

  if (!gitStatusResult.output) {
    ui.info("No changes to commit", "Working tree is clean.")
    return { ok: true, noChanges: true }
  }

  console.log(chalk.gray("\nCurrent changes:"))
  console.log(gitStatusResult.output)
  console.log("")

  const addSpinner = ui.createSpinner("Staging all changes...")
  addSpinner.start()

  const addResult = await runGitCommand(["add", "."])
  addSpinner.stop()

  if (!addResult.success) {
    ui.error("Failed to stage changes", addResult.error || "Unknown error")
    return { ok: false, error: "add_failed" }
  }

  ui.success("Changes staged", "All changes have been added.")

  let commitMessage = ""
  while (!commitMessage.trim()) {
    const { message } = await inquirer.prompt({
      type: "input",
      name: "message",
      message: chalk.bold("📝 Enter commit message:"),
      validate: (input: string) => {
        const trimmed = input.trim()
        if (!trimmed) {
          return "Commit message cannot be empty. Please enter a message."
        }
        return true
      },
    })
    commitMessage = message.trim()
  }

  const commitSpinner = ui.createSpinner("Committing changes...")
  commitSpinner.start()

  const commitResult = await runGitCommand(["commit", "-m", commitMessage])
  commitSpinner.stop()

  if (!commitResult.success) {
    ui.error("Failed to commit changes", commitResult.error || "Unknown error")
    return { ok: false, error: "commit_failed" }
  }

  ui.success("Commit successful!", commitMessage)
  
  if (commitResult.output) {
    console.log("")
    console.log(chalk.gray(commitResult.output))
  }

  return {
    ok: true,
    commitMessage,
  }
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
