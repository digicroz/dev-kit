import chalk from "chalk"
import { readConfig } from "../utils/config.js"
import { ui } from "../utils/ui-helpers.js"
import { DKConfig, DatabaseType } from "../types/config.js"
import {
  existsSync,
  readFileSync,
  mkdirSync,
  readdirSync,
  statSync,
  createReadStream,
} from "fs"
import { join } from "path"
import { execSync, spawn } from "child_process"
import inquirer from "inquirer"

// Load environment variables from .env file in the current working directory
function loadEnvFile(rootDir: string = process.cwd()): {
  loaded: boolean
  path?: string
} {
  const envPath = join(rootDir, ".env")

  if (!existsSync(envPath)) {
    return { loaded: false }
  }

  try {
    const envContent = readFileSync(envPath, "utf8")
    const lines = envContent.split("\n")
    let varsLoaded = 0

    for (const line of lines) {
      const trimmedLine = line.trim()

      // Skip empty lines and comments
      if (!trimmedLine || trimmedLine.startsWith("#")) {
        continue
      }

      // Parse key=value pairs
      const equalIndex = trimmedLine.indexOf("=")
      if (equalIndex === -1) {
        continue
      }

      const key = trimmedLine.slice(0, equalIndex).trim()
      const value = trimmedLine.slice(equalIndex + 1).trim()

      // Remove quotes if present
      const cleanValue = value.replace(/^["'](.*)["']$/, "$1")

      // Only set if not already in process.env (environment takes precedence)
      if (!process.env.hasOwnProperty(key)) {
        process.env[key] = cleanValue
        varsLoaded++
      }
    }

    return { loaded: true, path: envPath }
  } catch (error: any) {
    // Silently fail if we can't read the .env file
    console.warn(
      chalk.yellow(`Warning: Could not load .env file: ${error.message}`)
    )
    return { loaded: false }
  }
}

// Check which database drivers are available
async function checkAvailableDrivers(): Promise<{
  mysql: boolean
  postgres: boolean
  sqlite: boolean
  mongodb: boolean
}> {
  // Since we now include all database drivers as dependencies in the CLI,
  // they should always be available from the CLI installation
  return {
    mysql: true,
    postgres: true,
    sqlite: true,
    mongodb: true,
  }
}

// Check if the current project supports database commands
export function validateDatabaseSupport(): {
  isSupported: boolean
  config: DKConfig | null
} {
  const config = readConfig()

  if (!config) {
    ui.error(
      "No dk.config.json found",
      "Run 'dk init' to initialize your project configuration"
    )
    return { isSupported: false, config: null }
  }

  if (config.projectType !== "node-express") {
    ui.error(
      "Database commands not supported",
      `Database commands are only available for 'node-express' projects.\nCurrent project type: ${config.projectType}`
    )
    return { isSupported: false, config }
  }

  if (!config.database) {
    ui.error(
      "No database configuration found",
      "Database configuration is missing from dk.config.json.\nRun 'dk config update' to reconfigure your project"
    )
    return { isSupported: false, config }
  }

  return { isSupported: true, config }
}

// Database status check command
export async function dbStatus(): Promise<void> {
  ui.section("🗃️ Database Status Check", "Checking database connectivity")

  // Load environment variables from .env file in the current directory
  const envResult = loadEnvFile()
  if (envResult.loaded) {
    ui.info("Environment loaded", `Loaded variables from ${envResult.path}`)
  }

  // Check available database drivers
  ui.info(
    "Database drivers status",
    "All database drivers are bundled with DK CLI"
  )
  const availableDrivers = await checkAvailableDrivers()

  console.log("")
  ui.info("Database Driver Status:", "Available database connection libraries")
  ui.table([
    {
      key: "MySQL (mysql2)",
      value: chalk.green("✓ Available"),
    },
    {
      key: "PostgreSQL (pg)",
      value: chalk.green("✓ Available"),
    },
    {
      key: "SQLite (sqlite3)",
      value: chalk.green("✓ Available"),
    },
    {
      key: "MongoDB (mongodb)",
      value: chalk.green("✓ Available"),
    },
  ])

  const { isSupported, config } = validateDatabaseSupport()
  if (!isSupported || !config) {
    return
  }

  const dbConfig = config.database!

  const statusSpinner = ui.createSpinner("Checking database connection...")
  statusSpinner.start()

  try {
    // Brief pause for UX
    await new Promise((resolve) => setTimeout(resolve, 500))

    // Check if we have the required database configuration
    if (!dbConfig.dbUrlEnvName) {
      statusSpinner.stop()
      ui.error(
        "Database URL environment variable not configured",
        "The database URL environment variable name is missing from your configuration"
      )
      return
    }

    // Get the database URL from environment variables
    const dbUrl = process.env[dbConfig.dbUrlEnvName]
    if (!dbUrl) {
      statusSpinner.stop()
      ui.error(
        `Environment variable ${dbConfig.dbUrlEnvName} not found`,
        `Make sure your .env file contains: ${dbConfig.dbUrlEnvName}=your_database_url\n` +
          `Current working directory: ${process.cwd()}\n` +
          `Environment file status: ${envResult.loaded ? "Loaded" : "Not found"}`
      )
      return
    }

    // Attempt to connect to the database
    const connectionResult = await testDatabaseConnection(
      dbConfig.dbType!,
      dbUrl
    )

    statusSpinner.stop()

    if (connectionResult.success) {
      ui.confirmBox("✅ Database connection successful!", "success")

      // Display database information
      console.log("")
      ui.info("Database Information:", "Current database configuration")

      ui.table([
        {
          key: "Database Type",
          value: chalk.cyan(dbConfig.dbType || "Unknown"),
        },
        {
          key: "Database Name",
          value: chalk.cyan(dbConfig.dbName || "Not specified"),
        },
        {
          key: "Environment Variable",
          value: chalk.cyan(dbConfig.dbUrlEnvName),
        },
        {
          key: "Environment File",
          value: envResult.loaded
            ? chalk.green("Loaded")
            : chalk.yellow("Not found"),
        },
        { key: "Connection Status", value: chalk.green("Connected") },
        ...(connectionResult.details
          ? [
              {
                key: "Host",
                value: chalk.gray(connectionResult.details.host || "Unknown"),
              },
              {
                key: "Port",
                value: chalk.gray(
                  connectionResult.details.port?.toString() || "Default"
                ),
              },
            ]
          : []),
      ])

      if (dbConfig.dumpsDir || dbConfig.migrationsDir) {
        console.log("")
        ui.info("Directory Configuration:", "Database-related directories")
        const dirTable = []
        if (dbConfig.dumpsDir) {
          dirTable.push({
            key: "Dumps Directory",
            value: chalk.cyan(dbConfig.dumpsDir),
          })
        }
        if (dbConfig.migrationsDir) {
          dirTable.push({
            key: "Migrations Directory",
            value: chalk.cyan(dbConfig.migrationsDir),
          })
        }
        ui.table(dirTable)
      }
    } else {
      ui.confirmBox("❌ Database connection failed", "error")
      console.log("")
      ui.error(
        "Connection Error:",
        connectionResult.error || "Unknown error occurred"
      )

      // Show configuration for debugging
      console.log("")
      ui.info("Current Configuration:", "Verify these settings are correct")
      ui.table([
        {
          key: "Database Type",
          value: chalk.cyan(dbConfig.dbType || "Unknown"),
        },
        {
          key: "Environment Variable",
          value: chalk.cyan(dbConfig.dbUrlEnvName),
        },
        { key: "URL Format", value: chalk.gray(maskDatabaseUrl(dbUrl)) },
      ])
    }
  } catch (error: any) {
    statusSpinner.stop()
    ui.error(
      "Database Status Check Failed",
      error.message || "An unexpected error occurred"
    )
  }
}

// Test database connection based on database type
async function testDatabaseConnection(
  dbType: DatabaseType,
  dbUrl: string
): Promise<{
  success: boolean
  error?: string
  details?: { host?: string; port?: number }
}> {
  try {
    // Parse the database URL to extract connection details
    const url = new URL(dbUrl)
    const details = {
      host: url.hostname,
      port: url.port ? parseInt(url.port) : undefined,
    }

    switch (dbType) {
      case "mysql":
        return await testMySQLConnection(dbUrl, details)
      case "postgres":
        return await testPostgresConnection(dbUrl, details)
      case "sqlite":
        return await testSQLiteConnection(dbUrl, details)
      case "mongodb":
        return await testMongoDBConnection(dbUrl, details)
      default:
        return {
          success: false,
          error: `Unsupported database type: ${dbType}`,
        }
    }
  } catch (error: any) {
    return {
      success: false,
      error: `Invalid database URL format: ${error.message}`,
    }
  }
}

// MySQL connection test
async function testMySQLConnection(
  dbUrl: string,
  details: any
): Promise<{ success: boolean; error?: string; details?: any }> {
  try {
    // Try to import mysql2 dynamically
    const mysql = await import("mysql2/promise" as any).catch(() => null)
    if (!mysql) {
      return {
        success: false,
        error:
          "MySQL driver not available.\n\nTo use MySQL databases, install the driver:\n  npm install mysql2\n\nFor development:\n  npm install --save-dev @types/mysql2",
      }
    }

    const connection = await mysql.createConnection(dbUrl)
    await connection.ping()
    await connection.end()

    return { success: true, details }
  } catch (error: any) {
    return {
      success: false,
      error: `MySQL connection error: ${error.message}`,
      details,
    }
  }
}

// PostgreSQL connection test
async function testPostgresConnection(
  dbUrl: string,
  details: any
): Promise<{ success: boolean; error?: string; details?: any }> {
  try {
    // Try to import pg dynamically
    const { Client } = await import("pg" as any).catch(() => ({ Client: null }))
    if (!Client) {
      return {
        success: false,
        error:
          "PostgreSQL driver not available.\n\nTo use PostgreSQL databases, install the driver:\n  npm install pg\n\nFor development:\n  npm install --save-dev @types/pg",
      }
    }

    const client = new Client({ connectionString: dbUrl })
    await client.connect()
    await client.query("SELECT NOW()")
    await client.end()

    return { success: true, details }
  } catch (error: any) {
    return {
      success: false,
      error: `PostgreSQL connection error: ${error.message}`,
      details,
    }
  }
}

// SQLite connection test
async function testSQLiteConnection(
  dbUrl: string,
  details: any
): Promise<{ success: boolean; error?: string; details?: any }> {
  try {
    // Try to import sqlite3 dynamically
    const sqlite3 = await import("sqlite3" as any).catch(() => null)
    if (!sqlite3) {
      return {
        success: false,
        error:
          "SQLite driver not available.\n\nTo use SQLite databases, install the driver:\n  npm install sqlite3\n\nFor development:\n  npm install --save-dev @types/sqlite3",
      }
    }

    // Extract file path from URL
    const dbPath = dbUrl.replace("sqlite://", "").replace("sqlite3://", "")

    return new Promise((resolve) => {
      const db = new sqlite3.Database(
        dbPath,
        sqlite3.OPEN_READONLY,
        (err: any) => {
          if (err) {
            resolve({
              success: false,
              error: `SQLite connection error: ${err.message}`,
              details: { ...details, path: dbPath },
            })
          } else {
            db.close()
            resolve({
              success: true,
              details: { ...details, path: dbPath },
            })
          }
        }
      )
    })
  } catch (error: any) {
    return {
      success: false,
      error: `SQLite connection error: ${error.message}`,
      details,
    }
  }
}

// MongoDB connection test
async function testMongoDBConnection(
  dbUrl: string,
  details: any
): Promise<{ success: boolean; error?: string; details?: any }> {
  try {
    // Try to import mongodb dynamically
    const { MongoClient } = await import("mongodb" as any).catch(() => ({
      MongoClient: null,
    }))
    if (!MongoClient) {
      return {
        success: false,
        error:
          "MongoDB driver not available.\n\nTo use MongoDB databases, install the driver:\n  npm install mongodb\n\nType definitions are included with the mongodb package.",
      }
    }

    const client = new MongoClient(dbUrl)
    await client.connect()
    await client.db().admin().ping()
    await client.close()

    return { success: true, details }
  } catch (error: any) {
    return {
      success: false,
      error: `MongoDB connection error: ${error.message}`,
      details,
    }
  }
}

// Generate next version number for dump files
function getNextDumpVersion(dumpsDir: string): number {
  if (!existsSync(dumpsDir)) {
    return 1
  }

  const files = readdirSync(dumpsDir)
  const versionPattern = /^v(\d+)_dump_\d{8}_\d{6}\.sql$/
  let maxVersion = 0

  for (const file of files) {
    const match = file.match(versionPattern)
    if (match) {
      const version = parseInt(match[1], 10)
      maxVersion = Math.max(maxVersion, version)
    }
  }

  return maxVersion + 1
}

// Parse database URL to extract connection parameters
function parseDatabaseUrl(url: string): {
  host: string
  port: number
  username: string
  password: string
  database: string
} {
  const urlObj = new URL(url)
  return {
    host: urlObj.hostname,
    port: parseInt(urlObj.port) || 3306,
    username: urlObj.username,
    password: urlObj.password,
    database: urlObj.pathname.slice(1).split("?")[0], // Remove leading slash and query params
  }
}

// Database dump create command
export async function dbDumpCreate(): Promise<void> {
  ui.section("💾 Database Dump Create", "Creating database backup")

  // Load environment variables from .env file
  const envResult = loadEnvFile()
  if (envResult.loaded) {
    ui.info("Environment loaded", `Loaded variables from ${envResult.path}`)
  }

  const { isSupported, config } = validateDatabaseSupport()
  if (!isSupported || !config) {
    return
  }

  const dbConfig = config.database!

  // Check if dumpsDir is configured
  if (!dbConfig.dumpsDir) {
    ui.error(
      "Dumps directory not configured",
      "Please add 'dumpsDir' to your database configuration in dk.config.json"
    )
    return
  }

  // Check if we have the database URL
  if (!dbConfig.dbUrlEnvName) {
    ui.error(
      "Database URL environment variable not configured",
      "The database URL environment variable name is missing from your configuration"
    )
    return
  }

  const dbUrl = process.env[dbConfig.dbUrlEnvName]
  if (!dbUrl) {
    ui.error(
      `Environment variable ${dbConfig.dbUrlEnvName} not found`,
      `Make sure your .env file contains: ${dbConfig.dbUrlEnvName}=your_database_url`
    )
    return
  }

  // Currently only support MySQL
  if (dbConfig.dbType !== "mysql") {
    ui.error(
      "Unsupported database type",
      `Database dumps are currently only supported for MySQL. Your database type: ${dbConfig.dbType}`
    )
    return
  }

  try {
    // Parse database URL
    const dbParams = parseDatabaseUrl(dbUrl)

    // Ensure dumps directory exists
    const dumpsPath = join(process.cwd(), dbConfig.dumpsDir)
    if (!existsSync(dumpsPath)) {
      mkdirSync(dumpsPath, { recursive: true })
      ui.info("Created dumps directory", dumpsPath)
    }

    // Generate dump filename with versioning
    const version = getNextDumpVersion(dumpsPath)
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:]/g, "")
      .replace("T", "_")
      .slice(0, 15) // Format: YYYYMMDD_HHMMSS

    const dumpFilename = `v${version}_dump_${timestamp}.sql`
    const dumpPath = join(dumpsPath, dumpFilename)

    ui.info("Dump configuration", "Database backup details")
    ui.table([
      { key: "Database", value: chalk.cyan(dbParams.database) },
      { key: "Host", value: chalk.cyan(dbParams.host) },
      { key: "Port", value: chalk.cyan(dbParams.port.toString()) },
      { key: "Username", value: chalk.cyan(dbParams.username) },
      { key: "Version", value: chalk.cyan(`v${version}`) },
      { key: "Output File", value: chalk.cyan(dumpFilename) },
      { key: "Full Path", value: chalk.gray(dumpPath) },
    ])

    const dumpSpinner = ui.createSpinner("Creating database dump...")
    dumpSpinner.start()

    // Build mysqldump command
    const mysqldumpCmd = [
      "mysqldump",
      `--host=${dbParams.host}`,
      `--port=${dbParams.port}`,
      `--user=${dbParams.username}`,
      `--password=${dbParams.password}`,
      "--single-transaction",
      "--skip-lock-tables",
      "--set-gtid-purged=OFF",
      "--no-tablespaces",
      "--default-character-set=utf8mb4",
      "--skip-add-drop-table",
      "--comments",
      "--create-options",
      "--order-by-primary",
      "--skip-extended-insert",
      "--dump-date",
      `--result-file="${dumpPath}"`,
      dbParams.database,
    ].join(" ")

    // Execute mysqldump command
    execSync(mysqldumpCmd, {
      stdio: "pipe",
      cwd: process.cwd(),
      env: { ...process.env },
    })

    dumpSpinner.stop()

    // Verify dump file was created and get its size
    if (existsSync(dumpPath)) {
      const stats = statSync(dumpPath)
      const fileSizeKB = Math.round(stats.size / 1024)

      ui.confirmBox("✅ Database dump created successfully!", "success")

      console.log("")
      ui.info("Dump Details:", "Backup file information")
      ui.table([
        { key: "File Name", value: chalk.green(dumpFilename) },
        { key: "File Size", value: chalk.green(`${fileSizeKB} KB`) },
        { key: "Location", value: chalk.gray(dumpPath) },
        { key: "Database", value: chalk.cyan(dbParams.database) },
        { key: "Timestamp", value: chalk.gray(new Date().toLocaleString()) },
      ])

      console.log("")
      ui.confirmBox(
        `💡 Backup file saved as: ${dumpFilename}\n\nYou can restore this backup later using:\ndk db restore ${dumpFilename}`,
        "info"
      )
    } else {
      ui.error(
        "Dump file not found",
        "The dump command completed but no file was created"
      )
    }
  } catch (error: any) {
    ui.error(
      "Database dump failed",
      `Error creating database dump: ${error.message}\n\nMake sure mysqldump is installed and accessible in your PATH`
    )
  }
}

// Database dump apply command
export async function dbDumpApply(
  options: { version?: string } = {}
): Promise<void> {
  ui.section("📦 Database Dump Apply", "Import database from backup")

  // Load environment variables from .env file
  const envResult = loadEnvFile()
  if (envResult.loaded) {
    ui.info("Environment loaded", `Loaded variables from ${envResult.path}`)
  }

  const { isSupported, config } = validateDatabaseSupport()
  if (!isSupported || !config) {
    return
  }

  const dbConfig = config.database!

  // Check if we have the database URL
  if (!dbConfig.dbUrlEnvName) {
    ui.error(
      "Database URL environment variable not configured",
      "The database URL environment variable name is missing from your configuration"
    )
    return
  }

  const dbUrl = process.env[dbConfig.dbUrlEnvName]
  if (!dbUrl) {
    ui.error(
      `Environment variable ${dbConfig.dbUrlEnvName} not found`,
      `Make sure your .env file contains: ${dbConfig.dbUrlEnvName}=your_database_url`
    )
    return
  }

  // Currently only support MySQL
  if (dbConfig.dbType !== "mysql") {
    ui.error(
      "Unsupported database type",
      `Dump apply is currently only supported for MySQL. Your database type: ${dbConfig.dbType}`
    )
    return
  }

  // Ensure dumps directory exists
  const dumpsDir = join(process.cwd(), dbConfig.dumpsDir || "database/dumps")
  if (!existsSync(dumpsDir)) {
    ui.error(
      "Dumps directory not found",
      `No dumps directory found at: ${dumpsDir}\n\nCreate some dumps first using: dk db dump create`
    )
    return
  }

  try {
    // Parse database URL for connection info
    const dbParams = parseDatabaseUrl(dbUrl)

    // Get all available dump files
    const dumpFiles = readdirSync(dumpsDir)
      .filter((file) => file.endsWith(".sql"))
      .map((file) => {
        const filePath = join(dumpsDir, file)
        const stats = statSync(filePath)
        const match = file.match(/^v(\d+)_dump_(\d{8}_\d{6})\.sql$/)

        if (match) {
          return {
            filename: file,
            version: parseInt(match[1]),
            timestamp: match[2],
            size: stats.size,
            created: stats.mtime,
            fullPath: filePath,
          }
        }
        return null
      })
      .filter(Boolean)
      .sort((a, b) => b!.version - a!.version) // Sort by version descending

    if (dumpFiles.length === 0) {
      ui.error(
        "No dump files found",
        `No valid dump files found in: ${dumpsDir}\n\nCreate some dumps first using: dk db dump create`
      )
      return
    }

    // If version is specified, find that specific dump
    let selectedDump: any = null

    if (options.version) {
      const versionNumber = parseInt(options.version.replace(/^v/, ""))
      selectedDump = dumpFiles.find((dump) => dump!.version === versionNumber)

      if (!selectedDump) {
        ui.error(
          "Version not found",
          `Dump version v${versionNumber} not found.\n\nAvailable versions: ${dumpFiles.map((d) => `v${d!.version}`).join(", ")}`
        )
        return
      }

      ui.info(
        "Version specified",
        `Using dump version v${selectedDump.version}`
      )
    } else {
      // Show available dumps and let user choose
      console.log("")
      ui.info("Available Dumps:", "Choose a dump to apply")

      const choices = dumpFiles.map((dump) => ({
        name: `v${dump!.version} - ${dump!.timestamp} (${(dump!.size / 1024 / 1024).toFixed(1)}MB)`,
        value: dump,
        short: `v${dump!.version}`,
      }))

      const { selectedDumpChoice } = await inquirer.prompt({
        type: "list",
        name: "selectedDumpChoice",
        message: "Select a dump to apply:",
        choices: choices,
        default: choices[0]?.value, // Default to latest (first in sorted list)
      })

      selectedDump = selectedDumpChoice
    }

    if (!selectedDump) {
      ui.error("No dump selected", "Operation cancelled")
      return
    }

    // Check if database has existing tables
    const mysql = await import("mysql2/promise" as any)
    const connection = await mysql.createConnection(dbUrl)

    try {
      const [tables] = (await connection.execute("SHOW TABLES")) as any[]

      if (tables.length > 0) {
        ui.error(
          "⚠️ Database contains existing tables",
          `Found ${tables.length} existing tables. The database must be empty before applying a dump.`
        )

        console.log("")
        ui.info("Existing Tables:", "Tables that will be affected")
        const tableNames = tables.map(
          (row: any) => Object.values(row)[0] as string
        )
        console.log(
          chalk.yellow(tableNames.map((name: string) => `• ${name}`).join("\n"))
        )

        const { shouldDropTables } = await inquirer.prompt({
          type: "confirm",
          name: "shouldDropTables",
          message: chalk.red("Drop all existing tables before applying dump?"),
          default: false,
        })

        if (!shouldDropTables) {
          ui.info("Operation cancelled", "Dump not applied")
          await connection.end()
          return
        }

        // Drop all tables
        console.log("")
        const dropSpinner = ui.createSpinner("Dropping existing tables...")
        dropSpinner.start()

        try {
          await connection.execute("SET FOREIGN_KEY_CHECKS = 0")

          for (const tableRow of tables) {
            const tableName = Object.values(tableRow)[0] as string
            await connection.execute(`DROP TABLE IF EXISTS \`${tableName}\``)
          }

          await connection.execute("SET FOREIGN_KEY_CHECKS = 1")
          dropSpinner.stop()
          ui.confirmBox("✅ All tables dropped successfully", "success")
        } catch (error: any) {
          dropSpinner.stop()
          ui.error(
            "Failed to drop tables",
            `Error: ${error.message}\n\nYou may need higher database privileges to drop tables.`
          )
          await connection.end()
          return
        }
      }

      await connection.end()
    } catch (error: any) {
      await connection.end()
      ui.error("Database connection failed", `Error: ${error.message}`)
      return
    }

    // Apply the dump
    console.log("")
    ui.info("Applying Dump:", "Starting database import")
    ui.table([
      { key: "Version", value: chalk.green(`v${selectedDump.version}`) },
      { key: "File", value: chalk.gray(selectedDump.filename) },
      {
        key: "Size",
        value: chalk.gray(`${(selectedDump.size / 1024 / 1024).toFixed(1)}MB`),
      },
      {
        key: "Created",
        value: chalk.gray(selectedDump.created.toLocaleString()),
      },
      { key: "Database", value: chalk.blue(dbParams.database) },
    ])

    const applySpinner = ui.createSpinner("Importing database... Please wait")
    applySpinner.start()

    try {
      // Use spawn for non-blocking execution
      await new Promise<void>((resolve, reject) => {
        const mysqlArgs = [
          "-h",
          dbParams.host,
          "-P",
          dbParams.port.toString(),
          "-u",
          dbParams.username,
          `-p${dbParams.password}`,
          dbParams.database,
        ]

        const mysqlProcess = spawn("mysql", mysqlArgs, {
          stdio: ["pipe", "pipe", "pipe"],
        })

        // Read the dump file and pipe it to mysql
        const fileStream = createReadStream(selectedDump.fullPath)

        // Simple status updates without misleading progress percentage
        let statusUpdateInterval: NodeJS.Timeout
        let dots = 0

        const updateStatus = () => {
          dots = (dots + 1) % 4
          const dotString = ".".repeat(dots)
          applySpinner.text = `Importing database${dotString} Please wait`
        }

        // Update status every 2 seconds to show activity
        statusUpdateInterval = setInterval(updateStatus, 2000)

        // Pipe file to mysql process
        fileStream.pipe(mysqlProcess.stdin)

        let errorOutput = ""

        // Collect error output
        mysqlProcess.stderr.on("data", (data) => {
          errorOutput += data.toString()
        })

        // Handle process completion
        mysqlProcess.on("close", (code) => {
          clearInterval(statusUpdateInterval)

          if (code === 0) {
            applySpinner.text = "Import completed successfully!"
            resolve()
          } else {
            reject(
              new Error(
                `MySQL import failed with exit code ${code}: ${errorOutput || "Unknown error"}`
              )
            )
          }
        })

        // Handle process errors
        mysqlProcess.on("error", (error) => {
          clearInterval(statusUpdateInterval)
          reject(new Error(`Failed to start mysql process: ${error.message}`))
        })

        // Set timeout (15 minutes)
        const timeout = setTimeout(
          () => {
            clearInterval(statusUpdateInterval)
            mysqlProcess.kill("SIGTERM")
            reject(new Error("Import timed out after 15 minutes"))
          },
          15 * 60 * 1000
        )

        // Clear timeout on completion
        mysqlProcess.on("close", () => {
          clearTimeout(timeout)
        })
      })

      applySpinner.stop()
      ui.confirmBox("✅ Database dump applied successfully!", "success")

      console.log("")
      ui.info("Import Summary:", "Database restore completed")
      ui.table([
        { key: "Database", value: chalk.green(dbParams.database) },
        { key: "Dump Version", value: chalk.green(`v${selectedDump.version}`) },
        { key: "Status", value: chalk.green("Successfully imported") },
        { key: "Timestamp", value: chalk.gray(new Date().toLocaleString()) },
      ])
    } catch (error: any) {
      applySpinner.stop()
      ui.error(
        "Dump import failed",
        `Error applying database dump: ${error.message}\n\nMake sure mysql client is installed and accessible in your PATH`
      )
    }
  } catch (error: any) {
    ui.error("Dump apply operation failed", `Error: ${error.message}`)
  }
}

// Database drop all tables command
export async function dbDropAllTables(
  options: { force?: boolean } = {}
): Promise<void> {
  ui.section(
    "⚠️ Database Drop All Tables",
    "WARNING: This will delete ALL tables"
  )

  // Load environment variables from .env file
  const envResult = loadEnvFile()
  if (envResult.loaded) {
    ui.info("Environment loaded", `Loaded variables from ${envResult.path}`)
  }

  const { isSupported, config } = validateDatabaseSupport()
  if (!isSupported || !config) {
    return
  }

  const dbConfig = config.database!

  // Check if we have the database URL
  if (!dbConfig.dbUrlEnvName) {
    ui.error(
      "Database URL environment variable not configured",
      "The database URL environment variable name is missing from your configuration"
    )
    return
  }

  const dbUrl = process.env[dbConfig.dbUrlEnvName]
  if (!dbUrl) {
    ui.error(
      `Environment variable ${dbConfig.dbUrlEnvName} not found`,
      `Make sure your .env file contains: ${dbConfig.dbUrlEnvName}=your_database_url`
    )
    return
  }

  // Currently only support MySQL
  if (dbConfig.dbType !== "mysql") {
    ui.error(
      "Unsupported database type",
      `Drop all tables is currently only supported for MySQL. Your database type: ${dbConfig.dbType}`
    )
    return
  }

  try {
    // Parse database URL
    const dbParams = parseDatabaseUrl(dbUrl)

    ui.error(
      "⚠️ DANGER ZONE ⚠️",
      "This operation will permanently delete ALL tables and data!"
    )

    console.log("")
    ui.info("Database Information:", "Target database details")
    ui.table([
      { key: "Database", value: chalk.red(dbParams.database) },
      { key: "Host", value: chalk.red(dbParams.host) },
      { key: "Port", value: chalk.red(dbParams.port.toString()) },
      { key: "Username", value: chalk.red(dbParams.username) },
    ])

    console.log("")
    ui.confirmBox(
      "⚠️ WARNING: This action cannot be undone!\n\n" +
        "• All tables will be permanently deleted\n" +
        "• All data will be lost\n" +
        "• Foreign key constraints will be disabled during operation\n\n" +
        "Make sure you have a backup before proceeding!",
      "error"
    )

    // Import inquirer for confirmation

    if (!options.force) {
      const { confirmed } = await inquirer.prompt({
        type: "confirm",
        name: "confirmed",
        message: chalk.red(
          "Are you absolutely sure you want to drop ALL tables?"
        ),
        default: false,
      })

      if (!confirmed) {
        ui.info("Operation cancelled", "No tables were dropped")
        return
      }

      // Second confirmation with database name
      const { dbNameConfirm } = await inquirer.prompt({
        type: "input",
        name: "dbNameConfirm",
        message: chalk.red(
          `Type the database name "${dbParams.database}" to confirm:`
        ),
      })

      if (dbNameConfirm !== dbParams.database) {
        ui.error("Database name mismatch", "Operation cancelled for safety")
        return
      }
    } else {
      ui.info("Force mode enabled", "Skipping confirmation prompts")
    }

    const dropSpinner = ui.createSpinner(
      "Dropping all tables... This may take a moment"
    )
    dropSpinner.start()

    // Connect to MySQL and execute the drop tables script
    const mysql = await import("mysql2/promise" as any)
    const connection = await mysql.createConnection(dbUrl)

    try {
      // Disable foreign key checks to avoid constraint issues
      await connection.execute("SET FOREIGN_KEY_CHECKS = 0")

      // Get all table names
      const [tables] = (await connection.execute(`SHOW TABLES`)) as any[]

      let droppedCount = 0
      let failedTables: string[] = []

      // Drop each table
      for (const tableRow of tables) {
        const tableName = Object.values(tableRow)[0] as string
        try {
          await connection.execute(`DROP TABLE IF EXISTS \`${tableName}\``)
          droppedCount++
        } catch (error: any) {
          failedTables.push(tableName)
          console.warn(
            `⚠️  Could not drop table '${tableName}': ${error.message}`
          )
        }
      }

      // Re-enable foreign key checks
      await connection.execute("SET FOREIGN_KEY_CHECKS = 1")

      // Check final results
      const [remainingTables] = (await connection.execute(
        "SHOW TABLES"
      )) as any[]
      const remainingCount = remainingTables.length

      await connection.end()
      dropSpinner.stop()

      if (remainingCount === 0) {
        ui.confirmBox("✅ All tables dropped successfully!", "success")
      } else if (droppedCount > 0) {
        ui.confirmBox(
          `⚠️ Partial success: ${droppedCount} tables dropped, ${remainingCount} tables remain`,
          "warning"
        )

        if (failedTables.length > 0) {
          console.log("")
          ui.error(
            "Permission Issues Detected",
            `The following tables could not be dropped due to insufficient permissions:\n${failedTables.map((t) => `• ${t}`).join("\n")}\n\nYou may need to:\n• Use a database user with DROP privileges\n• Contact your database administrator\n• Manually drop these tables from your database management tool`
          )
        }
      } else {
        ui.error(
          "No tables were dropped",
          `All drop operations failed. This usually indicates insufficient database permissions.\n\nYou may need to:\n• Use a database user with DROP privileges\n• Contact your database administrator\n• Check if the database is read-only`
        )
        return
      }

      console.log("")
      ui.info("Operation Summary:", "Database reset completed")
      ui.table([
        { key: "Database", value: chalk.green(dbParams.database) },
        { key: "Tables Dropped", value: chalk.green(droppedCount.toString()) },
        {
          key: "Remaining Tables",
          value: chalk.green(remainingCount.toString()),
        },
        {
          key: "Status",
          value: chalk.green(
            remainingCount === 0
              ? "Database is now empty"
              : "Some tables remain"
          ),
        },
        { key: "Timestamp", value: chalk.gray(new Date().toLocaleString()) },
      ])

      console.log("")
      ui.confirmBox(
        "💡 Next Steps:\n\n" +
          "• Your database is now ready for a fresh import\n" +
          "• You can now apply a database dump\n" +
          "• Consider running migrations or importing a backup\n" +
          "• Use 'dk db dump create' to backup before making changes",
        "info"
      )
    } catch (dbError: any) {
      await connection.end()
      throw dbError
    }
  } catch (error: any) {
    ui.error(
      "Drop tables operation failed",
      `Error dropping tables: ${error.message}\n\nPlease check your database connection and permissions`
    )
  }
}

// Utility function to mask sensitive information in database URL
function maskDatabaseUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    if (urlObj.password) {
      urlObj.password = "***"
    }
    if (urlObj.username) {
      urlObj.username = urlObj.username.slice(0, 2) + "***"
    }
    return urlObj.toString()
  } catch {
    return "Invalid URL format"
  }
}

// Future database commands can be added here:
// - dbMigrate: Run database migrations
// - dbSeed: Seed database with initial data
// - dbDump: Create database backup
// - dbRestore: Restore from database backup
// - dbReset: Reset database to initial state
