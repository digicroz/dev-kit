// clean.ts
import { ui } from "../utils/ui-helpers.js"
import { promises as fs } from "fs"
import { join, resolve, sep } from "path"
import inquirer from "inquirer"
import { existsSync } from "fs"
import { spawn } from "child_process"
import fg from "fast-glob"
import minimist from "minimist"

type CleanItem = { pattern: string; type: "directory" | "files" }

const withinProject = (root: string, target: string) =>
  resolve(target).startsWith(resolve(root) + sep)

const readPkg = async () => {
  try {
    const raw = await fs.readFile("package.json", "utf8")
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

const isReactNative = async () => {
  const pkg = await readPkg()
  const hasRNDep =
    !!pkg.dependencies?.["react-native"] ||
    !!pkg.devDependencies?.["react-native"]
  return existsSync("android") && (existsSync("app.json") || hasRNDep)
}

const nodeDefaults: CleanItem[] = [
  { pattern: "dist/", type: "directory" },
  { pattern: "build/", type: "directory" },
  { pattern: ".next/", type: "directory" },
  { pattern: ".turbo/", type: "directory" },
  { pattern: "coverage/", type: "directory" },
  { pattern: "out/", type: "directory" },
  { pattern: "node_modules/.cache/", type: "directory" },
  { pattern: ".parcel-cache/", type: "directory" },
  { pattern: ".vite/", type: "directory" },
  { pattern: "**/*.log", type: "files" },
  { pattern: ".tmp/", type: "directory" },
]

const rnAndroidDefaults: CleanItem[] = [
  { pattern: "android/app/build/", type: "directory" },
  { pattern: "android/build/", type: "directory" },
  { pattern: "android/.gradle/", type: "directory" },
]

const rnIosDefaults: CleanItem[] = [
  { pattern: "ios/build/", type: "directory" },
  { pattern: "ios/Pods/", type: "directory" },
  { pattern: "ios/DerivedData/", type: "directory" }, // often outside repo, so this may no-op
]

const expand = async (items: CleanItem[], dryRun: boolean) => {
  // Expand patterns; for directories, ensure trailing slash is respected
  const entries = await Promise.all(
    items.map(async (it) => {
      const matches = await fg(
        it.type === "directory" ? `${it.pattern}` : it.pattern,
        {
          dot: true,
          onlyFiles: it.type === "files",
          onlyDirectories: it.type === "directory",
          markDirectories: true,
          unique: true,
          suppressErrors: true,
          followSymbolicLinks: false,
        }
      )
      return matches.map((m) => ({ ...it, path: m }))
    })
  )
  // Flatten
  const flat = entries.flat()
  if (dryRun) return flat
  return flat
}

const rmPath = async (p: string, isDir: boolean) => {
  try {
    const stat = await fs.stat(p).catch(() => null)
    const bytes = stat?.size ?? 0
    await fs.rm(p, { recursive: true, force: true })
    return { ok: true, bytes }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unknown error",
    }
  }
}

const runGradleClean = (platform: "android" | "ios") =>
  new Promise<void>((resolveDone) => {
    if (platform === "android" && existsSync("android")) {
      const isWin = process.platform === "win32"
      const cmd = isWin ? "gradlew.bat" : "./gradlew"
      const child = spawn(cmd, ["clean"], {
        cwd: "android",
        stdio: "ignore",
        shell: true, // Must be true on Windows to execute .bat files
      })
      child.on("close", () => resolveDone())
      child.on("error", () => resolveDone())
      return
    }
    resolveDone()
  })

export const clean = async () => {
  const argv = minimist(process.argv.slice(2), {
    alias: { y: "yes" },
    boolean: ["yes", "dry-run", "metro", "workspaces"],
    string: ["mode"],
    default: {},
  })

  const args = process.argv.slice(2).map((a) => a.toLowerCase())
  const dryRun = !!argv["dry-run"]
  const autoYes = !!argv.yes
  const nmOnly = args.includes("nm") || args.includes("node_modules")
  let cleanedNodeModules = false

  // Optional node_modules wipe
  if (nmOnly) {
    ui.section("🧹 Node Modules Cleanup", "Removing node_modules directory")
    const spinner = ui.createSpinner(
      dryRun ? "Would delete node_modules..." : "Deleting node_modules..."
    )
    spinner.start()
    try {
      if (!dryRun) await fs.rm("node_modules", { recursive: true, force: true })
      spinner.stop()
      ui.success(
        dryRun
          ? "Dry-run: node_modules would be deleted."
          : "node_modules deleted successfully!"
      )
      cleanedNodeModules = !dryRun
    } catch (error) {
      spinner.fail("Failed to delete node_modules")
      ui.error(
        "Error deleting node_modules",
        error instanceof Error ? error.message : "Unknown error"
      )
      process.exit(1)
    }
    // Continue to broader clean
  }

  ui.section(
    "🧹 Project Cleanup",
    "Removing build artifacts and temporary files"
  )

  const rnDetected = await isReactNative()
  let cleanMode: "all" | "node" | "rn-android" | "rn-ios" =
    (argv.mode as any) || (rnDetected ? "all" : "node")

  if (rnDetected && !argv.mode && !autoYes) {
    const { mode } = await inquirer.prompt({
      type: "list",
      name: "mode",
      message: "React Native project detected. What would you like to clean?",
      choices: [
        { name: "🧹 Clean all (Node + RN Android)", value: "all" },
        { name: "🟢 Clean Node project only", value: "node" },
        { name: "🤖 Clean RN Android only", value: "rn-android" },
        { name: "🍏 Clean RN iOS only", value: "rn-ios" },
      ],
      default: "all",
    })
    cleanMode = mode
  }

  // Compose items based on mode
  let items: CleanItem[] = []
  if (cleanMode === "all")
    items = [...nodeDefaults, ...rnAndroidDefaults, ...rnIosDefaults]
  else if (cleanMode === "node") items = nodeDefaults
  else if (cleanMode === "rn-android") items = rnAndroidDefaults
  else if (cleanMode === "rn-ios") items = rnIosDefaults

  // Expand to concrete paths
  const spinner = ui.createSpinner("Scanning for files to clean...")
  spinner.start()
  const root = process.cwd()
  const expanded = await expand(items, dryRun)
  spinner.stop()

  const toDelete = expanded
    .map((e: any) => ({
      path: e.path,
      isDir: e.type === "directory",
      pattern: e.pattern,
    }))
    .filter((e) => withinProject(root, e.path) && existsSync(e.path))

  if (toDelete.length === 0) {
    ui.info("Nothing to clean for this mode.")
    return {
      ok: true,
      stats: { cleanedNodeModules, files: 0, dirs: 0, bytes: 0 },
    }
  }

  ui.info("Found items to clean:\n")
  toDelete.forEach((it) => {
    console.log(`  ${it.isDir ? "📁" : "📄"} ${it.path}`)
  })
  console.log("")

  if (!autoYes) {
    const { proceed } = await inquirer.prompt({
      type: "confirm",
      name: "proceed",
      message: dryRun
        ? "Proceed with dry-run (no files will be deleted)?"
        : "Delete the items above?",
      default: true,
    })
    if (!proceed) {
      ui.info("Cancelled.")
      return { ok: false, cancelled: true }
    }
  }

  const cleanSpinner = ui.createSpinner(
    dryRun
      ? "Dry-run: simulating cleanup..."
      : "Cleaning files and directories..."
  )
  cleanSpinner.start()

  let files = 0,
    dirs = 0,
    bytes = 0

  for (const entry of toDelete) {
    cleanSpinner.text = `${dryRun ? "Would clean" : "Cleaning"} ${entry.path}...`
    if (dryRun) continue
    const res = await rmPath(entry.path, entry.isDir)
    if (res.ok) {
      if (entry.isDir) dirs++
      else files++
      bytes += res.bytes || 0
    }
  }

  // RN gradle clean
  if (!dryRun && (cleanMode === "all" || cleanMode === "rn-android")) {
    cleanSpinner.text = "Running Gradle clean..."
    await runGradleClean("android")
  }

  cleanSpinner.stop()

  ui.success(
    dryRun ? "Dry-run completed." : "Cleanup completed successfully!",
    dryRun
      ? "No files were deleted."
      : "All selected temporary files and build artifacts have been removed."
  )

  const kb = Math.max(1, Math.round(bytes / 1024))
  ui.table([
    { key: "Directories cleaned", value: dirs.toString() },
    { key: "Files removed", value: files.toString() },
    { key: "Mode", value: cleanMode },
    { key: "Dry run", value: dryRun ? "yes" : "no" },
    { key: "Node modules wiped", value: cleanedNodeModules ? "yes" : "no" },
    { key: "Approx. size freed", value: `${kb} KB` },
  ])

  return { ok: true, stats: { cleanedNodeModules, files, dirs, bytes } }
}
