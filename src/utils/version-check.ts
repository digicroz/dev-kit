import { promises as fs } from "fs"
import https from "https"
import os from "os"
import { fileURLToPath } from "url"
import { dirname, join } from "path"
import { ui } from "./ui-helpers.js"

const PACKAGE_NAME = "@digicroz/dev-kit"
const REGISTRY_URL = `https://registry.npmjs.org/@digicroz%2Fdev-kit/latest`
const CACHE_FILENAME = ".dk-update-check.json"

function getCacheFilePath(): string {
  const homeDir = os.homedir()
  if (!homeDir) {
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = dirname(__filename)
    return join(__dirname, "..", CACHE_FILENAME)
  }
  return join(homeDir, CACHE_FILENAME)
}

interface UpdateCheckCache {
  lastCheck?: string
}

function isSameCalendarDay(first: Date, second: Date): boolean {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  )
}

async function readCache(): Promise<UpdateCheckCache | null> {
  try {
    const filePath = getCacheFilePath()
    // console.log({ filePath })

    const contents = await fs.readFile(filePath, "utf8")
    return JSON.parse(contents) as UpdateCheckCache
  } catch {
    return null
  }
}

async function writeCache(cache: UpdateCheckCache): Promise<void> {
  try {
    const filePath = getCacheFilePath()
    await fs.writeFile(filePath, JSON.stringify(cache, null, 2), "utf8")
  } catch {
    // Ignore cache write failures.
  }
}

async function hasCheckedToday(): Promise<boolean> {
  const cache = await readCache()
  if (!cache?.lastCheck) return false

  const lastCheckDate = new Date(cache.lastCheck)
  if (Number.isNaN(lastCheckDate.getTime())) return false

  return isSameCalendarDay(lastCheckDate, new Date())
}

function isVersionGreater(latest: string, current: string): boolean {
  const parseSemver = (version: string) =>
    version
      .replace(/^v/, "")
      .split(".")
      .map((part) => parseInt(part, 10))

  const latestParts = parseSemver(latest)
  const currentParts = parseSemver(current)

  for (
    let i = 0;
    i < Math.max(latestParts.length, currentParts.length);
    i += 1
  ) {
    const latestPart = latestParts[i] || 0
    const currentPart = currentParts[i] || 0

    if (latestPart > currentPart) return true
    if (latestPart < currentPart) return false
  }

  return false
}

function fetchLatestVersion(timeoutMs = 5000): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const request = https.get(
        REGISTRY_URL,
        { timeout: timeoutMs },
        (response) => {
          let buffer = ""

          response.on("data", (chunk) => {
            buffer += chunk
          })

          response.on("end", () => {
            try {
              const parsed = JSON.parse(buffer)
              const version = parsed?.version
              resolve(typeof version === "string" ? version : null)
            } catch {
              resolve(null)
            }
          })
        },
      )

      request.on("error", () => resolve(null))
      request.on("timeout", () => {
        request.destroy()
        resolve(null)
      })
    } catch {
      resolve(null)
    }
  })
}

export function getUpdateCommandSuggestion(): string {
  return `npm install -g ${PACKAGE_NAME}@latest`
}

export async function checkDailyUpdate(currentVersion: string): Promise<void> {
  if (await hasCheckedToday()) {
    return
  }

  const latestVersion = await fetchLatestVersion()
  await writeCache({ lastCheck: new Date().toISOString() })

  if (!latestVersion || !isVersionGreater(latestVersion, currentVersion)) {
    return
  }

  ui.warning(
    "A newer version of DK is available.",
    `Current version: ${currentVersion}\nLatest version: ${latestVersion}\nRun: ${getUpdateCommandSuggestion()}`,
  )
}
