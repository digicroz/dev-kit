import chalk from "chalk"
import ora from "ora"
import { execSync, spawn } from "child_process"
import { existsSync, readFileSync, mkdirSync, copyFileSync } from "fs"
import { join } from "path"
import boxen from "boxen"
import gradientString from "gradient-string"

// Helper function to get app name from app.json
function getAppName(): string {
  try {
    const appJsonPath = join(process.cwd(), "app.json")
    if (existsSync(appJsonPath)) {
      const appJson = JSON.parse(readFileSync(appJsonPath, "utf8"))
      return appJson.name || appJson.displayName || "ReactNativeApp"
    }

    // Fallback to package.json if app.json doesn't exist
    const packageJsonPath = join(process.cwd(), "package.json")
    if (existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"))
      return packageJson.name || "ReactNativeApp"
    }

    return "ReactNativeApp"
  } catch (error) {
    return "ReactNativeApp"
  }
}

// Helper function to generate timestamp in format: DD_MM_YYYY_HH_MM
function getTimestamp(): string {
  const now = new Date()
  const day = now.getDate().toString().padStart(2, "0")
  const month = (now.getMonth() + 1).toString().padStart(2, "0")
  const year = now.getFullYear()
  const hours = now.getHours().toString().padStart(2, "0")
  const minutes = now.getMinutes().toString().padStart(2, "0")

  return `${day}_${month}_${year}_${hours}_${minutes}`
}

// Helper function to copy APK to organized folder
function copyApkToBuildsFolder(buildType: string = "release"): string | null {
  try {
    const appName = getAppName()
    const timestamp = getTimestamp()
    const apkBuildsDir = join(process.cwd(), "apk_builds")

    // Create apk_builds directory if it doesn't exist
    if (!existsSync(apkBuildsDir)) {
      mkdirSync(apkBuildsDir, { recursive: true })
    }

    // Source APK path
    const sourceApkPath = join(
      process.cwd(),
      "android",
      "app",
      "build",
      "outputs",
      "apk",
      buildType,
      `app-${buildType}.apk`
    )

    // Destination APK path with organized naming
    const destinationFileName = `${appName}_${buildType}_${timestamp}.apk`
    const destinationPath = join(apkBuildsDir, destinationFileName)

    if (existsSync(sourceApkPath)) {
      copyFileSync(sourceApkPath, destinationPath)
      return destinationPath
    }

    return null
  } catch (error) {
    console.error("Error copying APK:", error)
    return null
  }
}

// System check function
function performSystemCheck(): void {
  console.log(
    boxen(
      chalk.blue("🔍 System Check") +
        "\n" +
        chalk.gray("Verifying build requirements..."),
      {
        padding: { top: 0, bottom: 0, left: 1, right: 1 },
        margin: { top: 1, bottom: 1, left: 0, right: 0 },
        borderStyle: "round",
        borderColor: "blue",
        backgroundColor: "#0a0a1a",
      }
    )
  )

  const checks = [
    {
      name: "Android Directory",
      check: () => existsSync(join(process.cwd(), "android")),
    },
    {
      name: "Gradle Wrapper",
      check: () => existsSync(join(process.cwd(), "android", "gradlew.bat")),
    },
    {
      name: "App Configuration",
      check: () =>
        existsSync(join(process.cwd(), "app.json")) ||
        existsSync(join(process.cwd(), "package.json")),
    },
  ]

  checks.forEach(({ name, check }) => {
    const result = check()
    console.log(
      result
        ? chalk.green("✓") + chalk.gray(` ${name}`)
        : chalk.red("✗") + chalk.gray(` ${name}`)
    )
  })

  console.log("") // Empty line for spacing
}

// Enhanced build function with detailed progress
function runGradleBuildWithProgress(
  buildCommand: string,
  buildType: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const spinner = ora({
      text: chalk.cyan(`Starting ${buildType} build...`),
      spinner: "dots12",
      color: "cyan",
    }).start()

    const gradleProcess = spawn(
      "cmd",
      ["/c", `cd android && gradlew.bat ${buildCommand}`],
      {
        cwd: process.cwd(),
        stdio: "pipe",
      }
    )

    let currentTask = ""
    let progress = 0
    const progressSteps = [
      "Preparing build",
      "Compiling sources",
      "Processing resources",
      "Building APK",
      "Signing APK",
      "Finalizing",
    ]

    // Update progress periodically
    const progressInterval = setInterval(() => {
      progress = Math.min(progress + 1, progressSteps.length - 1)
      spinner.text = chalk.cyan(
        `${progressSteps[progress]}... ${buildType} build`
      )
    }, 3000)

    let buildOutput = ""
    let hasError = false

    gradleProcess.stdout?.on("data", (data) => {
      const output = data.toString()
      buildOutput += output

      // Parse Gradle output for task information
      const taskMatch = output.match(/> Task :([^\n]+)/)
      if (taskMatch) {
        const task = taskMatch[1]
        currentTask = task

        // Update spinner based on current task
        if (task.includes("compile")) {
          spinner.text = chalk.cyan(`📝 Compiling ${task.split(":").pop()}...`)
        } else if (task.includes("process")) {
          spinner.text = chalk.cyan(
            `⚙️  Processing ${task.split(":").pop()}...`
          )
        } else if (task.includes("assemble")) {
          spinner.text = chalk.cyan(`🔨 Assembling ${buildType} APK...`)
        } else if (task.includes("sign")) {
          spinner.text = chalk.cyan(`✍️  Signing APK...`)
        } else if (task.includes("transform")) {
          spinner.text = chalk.cyan(`🔄 Transforming resources...`)
        } else {
          spinner.text = chalk.cyan(`🔧 ${task.split(":").pop()}...`)
        }
      }

      // Check for build progress indicators
      if (output.includes("BUILD SUCCESSFUL")) {
        clearInterval(progressInterval)
        spinner.succeed(
          chalk.green(
            `✓ ${buildType.charAt(0).toUpperCase() + buildType.slice(1)} APK built successfully`
          )
        )
        resolve()
      }
    })

    gradleProcess.stderr?.on("data", (data) => {
      const error = data.toString()
      buildOutput += error

      // Check for specific error patterns
      if (error.includes("BUILD FAILED") || error.includes("FAILURE")) {
        hasError = true
        clearInterval(progressInterval)
        spinner.fail(chalk.red(`✗ Failed to build ${buildType} APK`))

        // Show more specific error information
        if (error.includes("OutOfMemoryError")) {
          console.log(
            chalk.yellow(
              "💡 Tip: Try increasing Gradle memory in gradle.properties"
            )
          )
        } else if (error.includes("permission denied")) {
          console.log(
            chalk.yellow(
              "💡 Tip: Check file permissions or close other applications"
            )
          )
        }
      }
    })

    gradleProcess.on("close", (code) => {
      clearInterval(progressInterval)

      if (code === 0 && !hasError) {
        if (!spinner.isSpinning) return // Already handled success
        spinner.succeed(
          chalk.green(
            `✓ ${buildType.charAt(0).toUpperCase() + buildType.slice(1)} APK built successfully`
          )
        )
        resolve()
      } else {
        if (!hasError) {
          spinner.fail(chalk.red(`✗ Build failed with exit code ${code}`))
        }
        reject(new Error(`Build failed with exit code ${code}`))
      }
    })

    gradleProcess.on("error", (error) => {
      clearInterval(progressInterval)
      spinner.fail(chalk.red(`✗ Failed to start build process`))
      reject(error)
    })
  })
}

// Enhanced clean function with detailed progress
function runGradleCleanWithProgress(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Show what will be cleaned
    console.log(
      boxen(
        chalk.blue("🔍 Clean Analysis") +
          "\n" +
          chalk.gray("Checking directories to clean..."),
        {
          padding: { top: 0, bottom: 0, left: 1, right: 1 },
          margin: { top: 1, bottom: 1, left: 0, right: 0 },
          borderStyle: "round",
          borderColor: "blue",
          backgroundColor: "#0a0a1a",
        }
      )
    )

    const dirsToCheck = [
      { path: "android/app/build", name: "App Build Directory" },
      { path: "android/build", name: "Android Build Directory" },
      { path: "android/.gradle", name: "Gradle Cache" },
    ]

    dirsToCheck.forEach(({ path, name }) => {
      const fullPath = join(process.cwd(), path)
      const exists = existsSync(fullPath)
      console.log(
        exists
          ? chalk.yellow("🗑️ ") + chalk.gray(`${name} (will be cleaned)`)
          : chalk.green("✓ ") + chalk.gray(`${name} (already clean)`)
      )
    })

    console.log("") // Empty line for spacing

    const spinner = ora({
      text: chalk.cyan("Initializing clean process..."),
      spinner: "dots12",
      color: "cyan",
    }).start()

    // Step 1: PowerShell force delete
    spinner.text = chalk.cyan("🗑️  Force deleting build directories...")

    try {
      execSync(
        'powershell -Command "if (Test-Path android\\app\\build) { Remove-Item -Path android\\app\\build -Recurse -Force }"',
        {
          stdio: "pipe",
          cwd: process.cwd(),
        }
      )
      spinner.text = chalk.cyan("✓ Build directories cleared")
    } catch (e) {
      spinner.text = chalk.cyan("⚠ Some files may be locked, continuing...")
    }

    // Step 2: Gradle clean with progress
    const gradleProcess = spawn(
      "cmd",
      ["/c", "cd android && gradlew.bat clean"],
      {
        cwd: process.cwd(),
        stdio: "pipe",
      }
    )

    let cleanOutput = ""
    let hasError = false
    let currentStep = 0

    const cleanSteps = [
      "Preparing clean",
      "Cleaning compiled classes",
      "Removing generated files",
      "Clearing build cache",
      "Finalizing cleanup",
    ]

    // Update progress periodically
    const progressInterval = setInterval(() => {
      currentStep = Math.min(currentStep + 1, cleanSteps.length - 1)
      spinner.text = chalk.cyan(`🧹 ${cleanSteps[currentStep]}...`)
    }, 1500)

    gradleProcess.stdout?.on("data", (data) => {
      const output = data.toString()
      cleanOutput += output

      // Parse Gradle clean output for task information
      const taskMatch = output.match(/> Task :([^\n]+)/)
      if (taskMatch) {
        const task = taskMatch[1]

        // Update spinner based on current clean task
        if (task.includes("clean")) {
          spinner.text = chalk.cyan(`🧹 Cleaning ${task.split(":").pop()}...`)
        } else if (task.includes("delete")) {
          spinner.text = chalk.cyan(`🗑️  Deleting ${task.split(":").pop()}...`)
        } else {
          spinner.text = chalk.cyan(`🔧 ${task.split(":").pop()}...`)
        }
      }

      // Check for clean completion
      if (output.includes("BUILD SUCCESSFUL")) {
        clearInterval(progressInterval)
        spinner.succeed(chalk.green("✓ Android project cleaned successfully"))

        // Show clean completion summary
        console.log(
          boxen(
            chalk.green("🧹 Clean Complete!") +
              "\n" +
              chalk.gray("• Build directories cleared") +
              "\n" +
              chalk.gray("• Gradle cache refreshed") +
              "\n" +
              chalk.gray("• Ready for fresh build"),
            {
              padding: { top: 0, bottom: 0, left: 1, right: 1 },
              margin: { top: 1, bottom: 1, left: 0, right: 0 },
              borderStyle: "round",
              borderColor: "green",
              backgroundColor: "#0a1a0a",
            }
          )
        )

        resolve()
      }
    })

    gradleProcess.stderr?.on("data", (data) => {
      const error = data.toString()
      cleanOutput += error

      // Check for specific error patterns
      if (error.includes("BUILD FAILED") || error.includes("FAILURE")) {
        hasError = true
        clearInterval(progressInterval)
        spinner.warn(
          chalk.yellow("⚠ Clean had issues, proceeding with build...")
        )

        // Show more specific error information
        if (error.includes("Unable to delete directory")) {
          console.log(
            chalk.gray(
              "Note: Some files may be locked by Windows Explorer or other processes"
            )
          )
        }
        resolve() // Don't reject, just warn and continue
      }
    })

    gradleProcess.on("close", (code) => {
      clearInterval(progressInterval)

      if (code === 0 && !hasError) {
        if (!spinner.isSpinning) return // Already handled success
        spinner.succeed(chalk.green("✓ Android project cleaned successfully"))
        resolve()
      } else {
        if (!hasError) {
          spinner.warn(chalk.yellow("⚠ Clean completed with warnings"))
        }
        resolve() // Don't reject, just warn and continue
      }
    })

    gradleProcess.on("error", (error) => {
      clearInterval(progressInterval)
      spinner.warn(chalk.yellow("⚠ Clean process had issues, continuing..."))
      resolve() // Don't reject, just warn and continue
    })
  })
}

// Helper function to handle Windows file locking issues
async function handleWindowsFileLocks() {
  console.log(
    boxen(
      chalk.yellow("⚠️  Windows File Lock Detected") +
        "\n" +
        chalk.gray("To fix this issue:") +
        "\n" +
        chalk.white("1. Close VS Code/Android Studio") +
        "\n" +
        chalk.white("2. Close Windows Explorer in project folder") +
        "\n" +
        chalk.white("3. Run: ") +
        chalk.cyan("taskkill /f /im java.exe") +
        "\n" +
        chalk.white("4. Try the build again"),
      {
        padding: { top: 0, bottom: 0, left: 1, right: 1 },
        borderStyle: "round",
        borderColor: "yellow",
        backgroundColor: "#1a1a00",
      }
    )
  )
}

export async function buildAndroidRelease(
  skipClean: boolean = false,
  buildType: string = "release"
) {
  console.log(
    boxen(
      gradientString("green", "blue")("📱 React Native Android Build") +
        "\n" +
        chalk.gray(`Building ${buildType} APK...`),
      {
        padding: { top: 0, bottom: 0, left: 1, right: 1 },
        margin: { top: 1, bottom: 1, left: 0, right: 0 },
        borderStyle: "round",
        borderColor: "green",
        backgroundColor: "#0a1a0a",
      }
    )
  )

  // Perform system check
  performSystemCheck()

  // Check if we're in a React Native project
  const androidDir = join(process.cwd(), "android")
  if (!existsSync(androidDir)) {
    console.log(
      boxen(
        chalk.red("❌ Error: ") +
          chalk.white("No Android directory found\n") +
          chalk.gray("Make sure you're in a React Native project root"),
        {
          padding: { top: 0, bottom: 0, left: 1, right: 1 },
          borderStyle: "round",
          borderColor: "red",
          backgroundColor: "#1a0000",
        }
      )
    )
    return
  }

  const gradlewPath = join(androidDir, "gradlew.bat")
  const hasGradlewBat = existsSync(gradlewPath)

  if (!hasGradlewBat) {
    console.log(
      boxen(
        chalk.red("❌ Error: ") +
          chalk.white("gradlew.bat not found in android directory\n") +
          chalk.gray("Make sure your React Native project is properly set up"),
        {
          padding: { top: 0, bottom: 0, left: 1, right: 1 },
          borderStyle: "round",
          borderColor: "red",
          backgroundColor: "#1a0000",
        }
      )
    )
    return
  }

  try {
    // Step 1: Clean (if not skipped)
    if (!skipClean) {
      console.log(
        boxen(
          chalk.yellow("🧹 Clean Process Starting") +
            "\n" +
            chalk.gray("Removing previous build artifacts..."),
          {
            padding: { top: 0, bottom: 0, left: 1, right: 1 },
            margin: { top: 1, bottom: 1, left: 0, right: 0 },
            borderStyle: "round",
            borderColor: "yellow",
            backgroundColor: "#1a1a00",
          }
        )
      )

      try {
        await runGradleCleanWithProgress()
      } catch (error: any) {
        // If clean fails completely, show help and continue
        console.log(
          chalk.gray(
            "Note: Clean process encountered issues, but continuing with build..."
          )
        )

        // Check if it's the specific Windows file lock error
        if (
          error.message &&
          error.message.includes("Unable to delete directory")
        ) {
          await handleWindowsFileLocks()
        }
      }
    } else {
      console.log(chalk.gray("⏭ Skipping clean step"))
    }

    // Step 2: Build with Enhanced Progress
    console.log(
      boxen(
        chalk.blue("🔨 Build Process Starting") +
          "\n" +
          chalk.gray(
            `Target: ${buildType.charAt(0).toUpperCase() + buildType.slice(1)} APK`
          ) +
          "\n" +
          chalk.gray("This may take a few minutes..."),
        {
          padding: { top: 0, bottom: 0, left: 1, right: 1 },
          margin: { top: 1, bottom: 1, left: 0, right: 0 },
          borderStyle: "round",
          borderColor: "blue",
          backgroundColor: "#0a0a1a",
        }
      )
    )

    try {
      const buildCommand =
        buildType === "debug" ? "assembleDebug" : "assembleRelease"
      await runGradleBuildWithProgress(buildCommand, buildType)
    } catch (error) {
      throw error
    }

    // Success message with build summary
    const buildTime = new Date().toLocaleTimeString()
    console.log(
      boxen(
        chalk.green("🎉 Build Complete!") +
          "\n" +
          chalk.gray(
            `Build Type: ${buildType.charAt(0).toUpperCase() + buildType.slice(1)}`
          ) +
          "\n" +
          chalk.gray(`Completed: ${buildTime}`) +
          "\n" +
          chalk.gray(
            `Original APK: android/app/build/outputs/apk/${buildType}/app-${buildType}.apk`
          ),
        {
          padding: { top: 0, bottom: 0, left: 1, right: 1 },
          margin: { top: 1, bottom: 0, left: 0, right: 0 },
          borderStyle: "round",
          borderColor: "green",
          backgroundColor: "#0a1a0a",
        }
      )
    )

    // Copy APK to organized builds folder
    const copySpinner = ora({
      text: chalk.cyan("Organizing APK in builds folder..."),
      spinner: "dots12",
      color: "cyan",
    }).start()

    const copiedApkPath = copyApkToBuildsFolder(buildType)

    if (copiedApkPath) {
      copySpinner.succeed(chalk.green("✓ APK copied to builds folder"))

      // Get file size for additional info
      try {
        const fs = require("fs")
        const stats = fs.statSync(copiedApkPath)
        const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2)

        console.log(
          boxen(
            chalk.blue("📦 APK Organized!") +
              "\n" +
              chalk.gray("Organized to:") +
              "\n" +
              chalk.cyan(copiedApkPath.replace(process.cwd(), ".")) +
              "\n" +
              chalk.gray(`Size: ${fileSizeInMB} MB`),
            {
              padding: { top: 0, bottom: 0, left: 1, right: 1 },
              margin: { top: 1, bottom: 0, left: 0, right: 0 },
              borderStyle: "round",
              borderColor: "blue",
              backgroundColor: "#0a0a1a",
            }
          )
        )
      } catch (e) {
        console.log(
          boxen(
            chalk.blue("📦 APK Organized!") +
              "\n" +
              chalk.gray("Organized to:") +
              "\n" +
              chalk.cyan(copiedApkPath.replace(process.cwd(), ".")),
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
    } else {
      copySpinner.warn(chalk.yellow("⚠ Could not copy APK to builds folder"))
    }
  } catch (error: any) {
    console.log(
      boxen(
        chalk.red("💥 Build Failed") +
          "\n" +
          chalk.white(error.message || "Unknown error occurred"),
        {
          padding: { top: 0, bottom: 0, left: 1, right: 1 },
          borderStyle: "round",
          borderColor: "red",
          backgroundColor: "#1a0000",
        }
      )
    )
    throw error
  }
}

// Wrapper function for debug builds
export async function buildAndroidDebug(skipClean: boolean = false) {
  return await buildAndroidRelease(skipClean, "debug")
}
