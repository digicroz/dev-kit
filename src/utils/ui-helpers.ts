import chalk from "chalk"
import boxen from "boxen"
import * as gradientString from "gradient-string"
import ora, { Ora } from "ora"
import { execSync } from "child_process"
import { existsSync, readFileSync } from "fs"
import path from "path"

/**
 * Enhanced UI helpers with beautiful styling
 */

export class UIHelper {
  private static instance: UIHelper
  private activeSpinners: Set<Ora> = new Set()

  private constructor() {}

  public static getInstance(): UIHelper {
    if (!UIHelper.instance) {
      UIHelper.instance = new UIHelper()
    }
    return UIHelper.instance
  }

  /**
   * Create a beautiful success message
   */
  public success(message: string, details?: string): void {
    console.log(chalk.green("✓"), chalk.bold(message))
    if (details) {
      console.log(chalk.gray("  " + details))
    }
  }

  /**
   * Create a beautiful error message
   */
  public error(message: string, details?: string): void {
    console.log(chalk.red("✗"), chalk.bold.red(message))
    if (details) {
      console.log(chalk.red("  " + details))
    }
  }

  /**
   * Create a beautiful info message
   */
  public info(message: string, details?: string): void {
    console.log(chalk.blue("ℹ"), chalk.bold.blue(message))
    if (details) {
      console.log(chalk.gray("  " + details))
    }
  }

  /**
   * Create a beautiful warning message
   */
  public warning(message: string, details?: string): void {
    console.log(chalk.yellow("⚠"), chalk.bold.yellow(message))
    if (details) {
      console.log(chalk.yellow("  " + details))
    }
  }

  /**
   * Create a beautiful progress spinner
   */
  public createSpinner(text: string, spinnerType: string = "dots12"): Ora {
    const spinner = ora({
      text: chalk.cyan(text),
      spinner: spinnerType as any,
      color: "cyan",
    })

    this.activeSpinners.add(spinner)
    return spinner
  }

  /**
   * Create a beautiful section header
   */
  public section(title: string, subtitle?: string): void {
    console.log("\n")
    const content =
      chalk.bold.white(title) + (subtitle ? "\n" + chalk.gray(subtitle) : "")
    console.log(
      boxen(content, {
        padding: { top: 0, bottom: 0, left: 1, right: 1 },
        borderStyle: "round",
        borderColor: "cyan",
        backgroundColor: "#001122",
      })
    )
    console.log("")
  }

  /**
   * Create a beautiful gradient text
   */
  public gradientText(
    text: string,
    colors: [string, string] = ["#ff6b6b", "#4ecdc4"]
  ): string {
    return gradientString.rainbow(text)
  }

  /**
   * Create a progress bar visualization
   */
  public progressBar(
    current: number,
    total: number,
    width: number = 20
  ): string {
    const percentage = Math.round((current / total) * 100)
    const completed = Math.round((width * current) / total)
    const remaining = width - completed

    const bar =
      chalk.green("█".repeat(completed)) + chalk.gray("░".repeat(remaining))
    return `${bar} ${chalk.cyan(percentage + "%")} (${current}/${total})`
  }

  /**
   * Create a beautiful table-like output
   */
  public table(data: Array<{ key: string; value: string }>): void {
    const maxKeyLength = Math.max(...data.map((item) => item.key.length))

    data.forEach((item) => {
      const padding = " ".repeat(maxKeyLength - item.key.length + 2)
      console.log(
        chalk.cyan(item.key) +
          chalk.gray(padding + "→") +
          chalk.white(" " + item.value)
      )
    })
  }

  /**
   * Cleanup all active spinners
   */
  public cleanup(): void {
    this.activeSpinners.forEach((spinner) => {
      if (spinner.isSpinning) {
        spinner.stop()
      }
    })
    this.activeSpinners.clear()
  }

  /**
   * Create a beautiful banner with ASCII art
   */
  public banner(text: string, subtitle?: string): void {
    console.log(this.gradientText(text, ["#ff6b6b", "#4ecdc4"]))
    if (subtitle) {
      console.log(chalk.gray(subtitle))
    }
    console.log("")
  }

  /**
   * Create a confirmation prompt with style
   */
  public confirmBox(
    message: string,
    type: "success" | "warning" | "error" | "info" = "info"
  ): void {
    const colorMap = {
      success: chalk.green,
      warning: chalk.yellow,
      error: chalk.red,
      info: chalk.blue,
    }

    const icons = {
      success: "✓",
      warning: "⚠",
      error: "✗",
      info: "ℹ",
    }

    const bgColors = {
      success: "#003300",
      warning: "#332200",
      error: "#330000",
      info: "#000033",
    }

    const borderColors = {
      success: "green",
      warning: "yellow",
      error: "red",
      info: "blue",
    }

    console.log(
      boxen(colorMap[type](icons[type] + " ") + chalk.bold.white(message), {
        padding: 1,
        margin: { top: 1, bottom: 1, left: 0, right: 0 },
        borderStyle: "round",
        borderColor: borderColors[type],
        backgroundColor: bgColors[type],
      })
    )
  }

  /**
   * Check if a config file exists for a tool
   */
  private hasConfigFile(
    tool: "eslint" | "prettier",
    projectRoot: string
  ): boolean {
    const eslintConfigs = [
      ".eslintrc.js",
      ".eslintrc.cjs",
      ".eslintrc.yaml",
      ".eslintrc.yml",
      ".eslintrc.json",
      ".eslintrc",
      "eslint.config.js",
      "eslint.config.mjs",
      "eslint.config.cjs",
    ]
    const prettierConfigs = [
      ".prettierrc",
      ".prettierrc.json",
      ".prettierrc.yml",
      ".prettierrc.yaml",
      ".prettierrc.js",
      ".prettierrc.cjs",
      ".prettierrc.mjs",
      ".prettierrc.toml",
      "prettier.config.js",
      "prettier.config.cjs",
      "prettier.config.mjs",
    ]

    const configs = tool === "eslint" ? eslintConfigs : prettierConfigs

    // Also check package.json for config
    const packageJsonPath = path.join(projectRoot, "package.json")
    if (existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"))
        if (tool === "eslint" && packageJson.eslintConfig) return true
        if (tool === "prettier" && packageJson.prettier) return true
      } catch (error) {
        // Ignore JSON parse errors
      }
    }

    return configs.some((config) => existsSync(path.join(projectRoot, config)))
  }

  /**
   * Run ESLint and Prettier on a file if configs are present
   */
  public async formatGeneratedFile(
    filePath: string,
    projectRoot: string = process.cwd()
  ): Promise<void> {
    const hasEslint = this.hasConfigFile("eslint", projectRoot)
    const hasPrettier = this.hasConfigFile("prettier", projectRoot)

    if (!hasEslint && !hasPrettier) {
      return // No formatting tools configured
    }

    const spinner = this.createSpinner("Formatting generated file...")
    spinner.start()

    try {
      if (hasEslint) {
        spinner.text = "Running ESLint..."
        try {
          execSync(`npx eslint --fix "${filePath}"`, {
            stdio: "pipe",
            cwd: projectRoot,
          })
          this.info("ESLint formatting applied")
        } catch (error) {
          // ESLint might exit with code 1 even when fixing issues successfully
          // Only show error if it's a real error, not just warnings/fixes
          const errorMessage =
            error instanceof Error ? error.message : String(error)
          if (!errorMessage.includes("--fix")) {
            this.warning(
              "ESLint encountered some issues but file was processed"
            )
          }
        }
      }

      if (hasPrettier) {
        spinner.text = "Running Prettier..."
        try {
          execSync(`npx prettier --write "${filePath}"`, {
            stdio: "pipe",
            cwd: projectRoot,
          })
          this.info("Prettier formatting applied")
        } catch (error) {
          this.warning("Prettier encountered issues but file was processed")
        }
      }

      spinner.stop()

      if (hasEslint || hasPrettier) {
        const tools = []
        if (hasEslint) tools.push("ESLint")
        if (hasPrettier) tools.push("Prettier")
        this.success(
          "Code formatting completed",
          `Applied ${tools.join(" and ")} to generated file`
        )
      }
    } catch (error) {
      spinner.fail("Formatting failed")
      this.warning(
        "Code formatting encountered issues",
        error instanceof Error ? error.message : "Unknown error"
      )
    }
  }
}

// Export singleton instance
export const ui = UIHelper.getInstance()

// Export individual functions for convenience
export const {
  success,
  error,
  info,
  warning,
  section,
  gradientText,
  progressBar,
  table,
  banner,
  confirmBox,
  formatGeneratedFile,
} = ui
