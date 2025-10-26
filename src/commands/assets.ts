import { ui } from "../utils/ui-helpers.js"
import { readConfig } from "../utils/config.js"
import { promises as fs } from "fs"
import path from "path"
import { existsSync } from "fs"
import sizeOf from "image-size"

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
  const imageNameCase = imageConfig.nameCase || "kebab-case"

  const baseDirPath = path.resolve(
    path.join(assetsConfig.baseDir, imageConfig.baseDir)
  )

  if (!existsSync(baseDirPath)) {
    ui.error(
      "Images directory not found",
      `Directory ${baseDirPath} does not exist`
    )
    process.exit(1)
  }

  ui.section("🎨 Assets Generation", "Generating image index file")

  const spinner = ui.createSpinner("Scanning for images...")
  spinner.start()

  try {
    let publicDirPath: string | null = null
    let publicFiles: string[] = []

    if (config.projectType === "nextjs" && assetsConfig.publicDir) {
      publicDirPath = path.resolve(
        path.join(assetsConfig.publicDir, imageConfig.baseDir)
      )

      if (existsSync(publicDirPath)) {
        spinner.text = "Renaming images in public directory..."
        await renameImagesInDirectory(publicDirPath, imageNameCase)

        spinner.text = "Scanning public directory..."
        publicFiles = await walk(publicDirPath)
      }
    }

    spinner.text = "Renaming images in base directory..."
    const renameMap = await renameImagesInDirectory(baseDirPath, imageNameCase)

    if (renameMap.size > 0) {
      ui.info(
        `Renamed ${renameMap.size} files to match ${imageNameCase} convention`
      )
    }

    spinner.text = "Scanning base directory..."
    const baseFiles = await walk(baseDirPath)

    const baseFileNames = new Set(
      baseFiles.map((f) => {
        const relPath = path.relative(baseDirPath, f)
        return path.posix.normalize(
          relPath.split(path.sep).join(path.posix.sep)
        )
      })
    )

    const publicFileNames = new Set(
      publicFiles.map((f) => {
        const relPath = path.relative(publicDirPath!, f)
        return path.posix.normalize(
          relPath.split(path.sep).join(path.posix.sep)
        )
      })
    )

    const duplicates = [...baseFileNames].filter((name) =>
      publicFileNames.has(name)
    )

    if (duplicates.length > 0) {
      spinner.fail("Failed to generate image index")
      ui.error(
        "Duplicate files found",
        `The following files exist in both base and public directories:\n${duplicates.map((d) => `  - ${d}`).join("\n")}`
      )
      process.exit(1)
    }

    spinner.text = "Processing images..."

    const usedVarNames = new Set<string>()
    const imports: string[] = []
    const typeImports: string[] = []
    const tree: any = {}

    if (config.projectType === "nextjs" && publicFiles.length > 0) {
      typeImports.push(`import type { StaticImageData } from "next/image";`)
    }

    for (const abs of baseFiles) {
      const relFromImages = path.posix.normalize(
        path.relative(baseDirPath, abs).split(path.sep).join(path.posix.sep)
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

    if (config.projectType === "nextjs" && publicDirPath) {
      for (const abs of publicFiles) {
        const relFromImages = path.posix.normalize(
          path.relative(publicDirPath, abs).split(path.sep).join(path.posix.sep)
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

        const imageBuffer = await fs.readFile(abs)
        const dimensions = sizeOf(imageBuffer)
        const publicPathParts = assetsConfig.publicDir!.split(path.sep)
        const lastPart = publicPathParts[publicPathParts.length - 1]
        const staticPath = `/${lastPart}/${imageConfig.baseDir}/${relFromImages}`

        const varBase = toValidIdentifier(
          [...dirParts, baseNoExt].map(toCamel).filter(Boolean).join("_") ||
            toCamel(baseNoExt)
        )
        const varName = ensureUnique(varBase || "img", usedVarNames)

        const staticImageData = `{
  src: ${JSON.stringify(staticPath.replace("/public", ""))},
  width: ${dimensions.width || 0},
  height: ${dimensions.height || 0},
}`

        imports.push(`const ${varName}: StaticImageData = ${staticImageData};`)

        const keysPath = [...dirKeys, fileKey || "image"]
        setInTree(tree, keysPath, varName)
      }
    }

    const sortedTree = sortObjectKeysDeep(tree)

    const outputFile = path.join(baseDirPath, "index.ts")

    spinner.text = "Generating index file..."

    const infoComment = imageConfig.infoComment || "short_info"
    let header = ""

    if (infoComment === "short_info") {
      header = `/* AUTO-GENERATED FILE. DO NOT EDIT.
   * Run: dk gen
   */
`
    }

    let body: string

    if (config.projectType === "react-native-cli") {
      body = `export const ImageAssets = ${objectToTS(sortedTree)};\n`
    } else {
      const allImports = [...typeImports, ...imports.sort()].join("\n")
      body =
        `${allImports}\n\n` +
        `export const ImageAssets = ${objectToTS(sortedTree)} as const;\n`
    }

    await fs.writeFile(outputFile, header + body, "utf8")

    spinner.stop()

    await ui.formatGeneratedFile(outputFile, process.cwd())

    const totalFiles = baseFiles.length + publicFiles.length
    const message =
      totalFiles === 0
        ? "Image index generated with empty object (no images found)"
        : `Image index generated successfully with ${totalFiles} images`

    ui.success("Image index generated successfully!", message)

    const tableData = [
      { key: "Images processed", value: totalFiles.toString() },
      { key: "Base directory images", value: baseFiles.length.toString() },
    ]

    if (publicFiles.length > 0) {
      tableData.push({
        key: "Public directory images",
        value: publicFiles.length.toString(),
      })
    }

    tableData.push(
      { key: "Output file", value: path.relative(process.cwd(), outputFile) },
      {
        key: "Base directory",
        value: path.relative(process.cwd(), baseDirPath),
      }
    )

    if (publicDirPath && publicFiles.length > 0) {
      tableData.push({
        key: "Public directory",
        value: path.relative(process.cwd(), publicDirPath),
      })
    }

    tableData.push({ key: "Naming convention", value: imageNameCase })

    ui.table(tableData)
  } catch (error) {
    spinner.fail("Failed to generate image index")
    ui.error(
      "Error generating image index",
      error instanceof Error ? error.message : "Unknown error"
    )
    process.exit(1)
  }
}
