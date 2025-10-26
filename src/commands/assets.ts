import { ui } from "../utils/ui-helpers.js"
import { readConfig } from "../utils/config.js"
import { promises as fs } from "fs"
import path from "path"
import { existsSync } from "fs"

const IMAGE_EXTS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".bmp",
  ".svg",
  ".avif",
])

function toCamel(str: string): string {
  return str
    .replace(/[_\s\-\.]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ""))
    .replace(/^[A-Z]/, (m) => m.toLowerCase())
    .replace(/[^a-zA-Z0-9]/g, "")
}

function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[\s_\.]+/g, "-")
    .toLowerCase()
    .replace(/[^a-z0-9\-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

function toSnakeCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[\s\-\.]+/g, "_")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
}

function convertImageName(
  fileName: string,
  nameCase: "kebab-case" | "snake_case" | "any"
): string {
  if (nameCase === "any") {
    return fileName
  }

  const ext = path.extname(fileName)
  const nameWithoutExt = path.basename(fileName, ext)

  if (nameCase === "kebab-case") {
    return toKebabCase(nameWithoutExt) + ext
  } else if (nameCase === "snake_case") {
    return toSnakeCase(nameWithoutExt) + ext
  }

  return fileName
}

function toValidIdentifier(str: string): string {
  const cleaned = str.replace(/[^a-zA-Z0-9_]/g, "_")
  return /^[a-zA-Z_]/.test(cleaned) ? cleaned : `_${cleaned}`
}

function ensureUnique(name: string, used: Set<string>): string {
  let n = name
  let i = 2
  while (used.has(n)) n = `${name}${i++}`
  used.add(n)
  return n
}

async function walk(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files: string[] = []
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) {
      files.push(...(await walk(full)))
    } else if (e.isFile()) {
      const ext = path.extname(e.name).toLowerCase()
      if (IMAGE_EXTS.has(ext) && !(path.basename(full) === "index.ts")) {
        files.push(full)
      }
    }
  }
  return files
}

function setInTree(tree: any, pathParts: string[], leafValue: string): void {
  let node = tree
  for (let i = 0; i < pathParts.length - 1; i++) {
    const part = pathParts[i]
    if (!node[part]) node[part] = {}
    node = node[part]
  }
  node[pathParts[pathParts.length - 1]] = leafValue
}

function sortObjectKeysDeep(obj: any): any {
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    const sorted: any = {}
    for (const key of Object.keys(obj).sort()) {
      sorted[key] = sortObjectKeysDeep(obj[key])
    }
    return sorted
  }
  return obj
}

function objectToTS(obj: any, indent = 0): string {
  const pad = "  ".repeat(indent)
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    const entries = Object.entries(obj).map(([k, v]) => {
      const key = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(k) ? k : JSON.stringify(k)
      return `${"  ".repeat(indent + 1)}${key}: ${objectToTS(v, indent + 1)}`
    })
    return `{\n${entries.join(",\n")}\n${pad}}`
  }
  // leaf is a variable name string
  return obj
}

async function renameImagesInDirectory(
  dir: string,
  nameCase: "kebab-case" | "snake_case" | "any"
): Promise<Map<string, string>> {
  const renameMap = new Map<string, string>()

  if (nameCase === "any") {
    return renameMap
  }

  const allFiles = await walk(dir)

  for (const filePath of allFiles) {
    const fileName = path.basename(filePath)
    const convertedName = convertImageName(fileName, nameCase)

    if (fileName !== convertedName) {
      const newPath = path.join(path.dirname(filePath), convertedName)

      // Handle case-insensitive file systems (like Windows)
      // where the source and target might be considered the same file
      if (
        existsSync(newPath) &&
        fileName.toLowerCase() !== convertedName.toLowerCase()
      ) {
        throw new Error(
          `Cannot rename ${fileName} to ${convertedName}: target file already exists`
        )
      }

      // For case-only changes on case-insensitive file systems,
      // use a temporary filename to avoid conflicts
      if (
        fileName.toLowerCase() === convertedName.toLowerCase() &&
        fileName !== convertedName
      ) {
        const tempPath = path.join(path.dirname(filePath), `${fileName}.tmp`)
        await fs.rename(filePath, tempPath)
        await fs.rename(tempPath, newPath)
      } else {
        await fs.rename(filePath, newPath)
      }

      renameMap.set(filePath, newPath)
    }
  }

  return renameMap
}

export const generateImageIndex = async (): Promise<void> => {
  const config = readConfig()

  if (!config) {
    ui.error("Configuration not found", "Please run 'dk init' first")
    process.exit(1)
  }

  const supportedTypes = ["vite-react", "react-native-cli", "nextjs"]
  if (!supportedTypes.includes(config.projectType)) {
    ui.error(
      "Unsupported project type",
      `Assets generation is only supported for: ${supportedTypes.join(", ")}`
    )
    process.exit(1)
  }

  if (!config.generators?.assets?.image) {
    ui.warning(
      "Images configuration not found",
      "Please configure 'generators.assets.image' in dk.config.json"
    )
    return
  }

  const assetsConfig = config.generators.assets
  const imageConfig = assetsConfig.image!

  const imagesDir = path.resolve(
    path.join(assetsConfig.baseDir, imageConfig.baseDir)
  )
  const imageNameCase = imageConfig.nameCase || "kebab-case"

  if (!existsSync(imagesDir)) {
    ui.error(
      "Images directory not found",
      `Directory ${imagesDir} does not exist`
    )
    process.exit(1)
  }

  ui.section("🎨 Assets Generation", "Generating image index file")

  const spinner = ui.createSpinner("Scanning for images...")
  spinner.start()

  try {
    spinner.text = "Renaming images to match naming convention..."
    const renameMap = await renameImagesInDirectory(imagesDir, imageNameCase)

    if (renameMap.size > 0) {
      ui.info(
        `Renamed ${renameMap.size} files to match ${imageNameCase} convention`
      )
    }

    spinner.text = "Scanning for images..."
    const allFiles = await walk(imagesDir)

    spinner.text = "Processing images..."

    const usedVarNames = new Set<string>()
    const imports: string[] = []
    const tree: any = {}

    for (const abs of allFiles) {
      const relFromImages = path.posix.normalize(
        path.relative(imagesDir, abs).split(path.sep).join(path.posix.sep)
      )

      const dirParts =
        path.posix.dirname(relFromImages) === "."
          ? []
          : path.posix.dirname(relFromImages).split("/")

      const baseNoExt = path.basename(
        relFromImages,
        path.extname(relFromImages)
      )
      const fileKey = toCamel(baseNoExt)
      const dirKeys = dirParts.map(toCamel)

      const importPath = `./${relFromImages}`

      if (config.projectType === "react-native-cli") {
        const requireStatement = `require(${JSON.stringify(importPath)})`
        const keysPath = [...dirKeys, fileKey || "image"]
        setInTree(tree, keysPath, requireStatement)
      } else {
        const varBase = toValidIdentifier(
          [...dirParts, baseNoExt].map(toCamel).filter(Boolean).join("_") ||
            toCamel(baseNoExt)
        )
        const varName = ensureUnique(varBase || "img", usedVarNames)

        imports.push(`import ${varName} from ${JSON.stringify(importPath)};`)
        const keysPath = [...dirKeys, fileKey || "image"]
        setInTree(tree, keysPath, varName)
      }
    }

    const sortedTree = sortObjectKeysDeep(tree)

    const outputFile = path.join(imagesDir, "index.ts")

    spinner.text = "Generating index file..."

    const infoComment = imageConfig.infoComment || "short_info"
    let header = ""

    if (infoComment === "short_info") {
      header = `/* AUTO-GENERATED FILE. DO NOT EDIT.
   * Run: dk assets gen
   */
`
    }
    let body: string

    if (config.projectType === "react-native-cli") {
      body = `export const ImageAssets = ${objectToTS(sortedTree)};\n`
    } else {
      body =
        `${imports.sort().join("\n")}\n\n` +
        `export const ImageAssets = ${objectToTS(sortedTree)} as const;\n`
    }

    await fs.writeFile(outputFile, header + body, "utf8")

    spinner.stop()

    await ui.formatGeneratedFile(outputFile, process.cwd())

    const message =
      allFiles.length === 0
        ? "Image index generated with empty object (no images found)"
        : `Image index generated successfully with ${allFiles.length} images`

    ui.success("Image index generated successfully!", message)

    ui.table([
      { key: "Images processed", value: allFiles.length.toString() },
      { key: "Output file", value: path.relative(process.cwd(), outputFile) },
      {
        key: "Images directory",
        value: path.relative(process.cwd(), imagesDir),
      },
      { key: "Naming convention", value: imageNameCase },
    ])
  } catch (error) {
    spinner.fail("Failed to generate image index")
    ui.error(
      "Error generating image index",
      error instanceof Error ? error.message : "Unknown error"
    )
    process.exit(1)
  }
}

export const assets = async (): Promise<void> => {
  const args = process.argv.slice(2)
  const subcommand = args[args.indexOf("assets") + 1]

  if (subcommand === "gen" || subcommand === "generate") {
    await generateImageIndex()
  } else {
    ui.error(
      "Invalid subcommand",
      "Available commands: 'dk assets gen' or 'dk assets generate'"
    )
    process.exit(1)
  }
}
