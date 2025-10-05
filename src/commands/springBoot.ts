import { spawn, ChildProcess } from "child_process"
import { join } from "path"
import { existsSync } from "fs"
import { ui } from "../utils/ui-helpers"
import { readConfig, configExists } from "../utils/config"
import type { SpringBootService } from "../types/config"

export async function startSpringBootServices() {
  if (!configExists()) {
    ui.error("dk.config.json not found. Run 'dk init' first.")
    return
  }

  const config = readConfig()
  if (!config || config.projectType !== "spring-boot-microservice") {
    ui.error(
      "This command is only available for Spring Boot microservice projects."
    )
    return
  }

  if (!config.springBoot?.services || config.springBoot.services.length === 0) {
    ui.error(
      "No Spring Boot services configured. Run 'dk init' to configure services."
    )
    return
  }

  ui.info("Starting Spring Boot microservices...")

  // Sort services by starting order
  const sortedServices = [...config.springBoot.services].sort(
    (a, b) => a.startingOrderIndex - b.startingOrderIndex
  )

  const runningProcesses: {
    service: SpringBootService
    process: ChildProcess
  }[] = []

  try {
    for (const service of sortedServices) {
      await startService(service, runningProcesses)

      // Wait a bit between service starts to avoid overwhelming the system
      if (sortedServices.indexOf(service) < sortedServices.length - 1) {
        ui.info(`Waiting 3 seconds before starting next service...`)
        await new Promise((resolve) => setTimeout(resolve, 3000))
      }
    }

    ui.success("All Spring Boot services started successfully!")
    ui.info("Press Ctrl+C to stop all services.")

    // Handle graceful shutdown
    process.on("SIGINT", () => {
      ui.info("\nShutting down all services...")
      runningProcesses.forEach(({ service, process }) => {
        ui.info(`Stopping ${service.name}...`)
        process.kill("SIGTERM")
      })
      process.exit(0)
    })

    // Keep the process alive
    await new Promise(() => {})
  } catch (error: any) {
    ui.error("Failed to start services:", error.message)

    // Clean up any running processes
    runningProcesses.forEach(({ service, process }) => {
      ui.info(`Stopping ${service.name}...`)
      process.kill("SIGTERM")
    })
  }
}

async function startService(
  service: SpringBootService,
  runningProcesses: { service: SpringBootService; process: ChildProcess }[]
): Promise<void> {
  const servicePath = join(process.cwd(), service.path)

  if (!existsSync(servicePath)) {
    throw new Error(`Service directory not found: ${servicePath}`)
  }

  ui.info(`Starting ${service.name} (order: ${service.startingOrderIndex})`)
  ui.info(`Service path: ${servicePath}`)

  // Check for Maven wrapper
  const mvnwPath = process.platform === "win32" ? "mvnw.cmd" : "./mvnw"
  const mvnwFullPath = join(
    servicePath,
    process.platform === "win32" ? "mvnw.cmd" : "mvnw"
  )

  if (!existsSync(mvnwFullPath)) {
    throw new Error(
      `Maven wrapper not found in ${servicePath}. Expected: ${mvnwFullPath}`
    )
  }

  return new Promise((resolve, reject) => {
    const args = ["spring-boot:run"]
    const command = process.platform === "win32" ? mvnwPath : mvnwPath

    ui.info(`Executing: ${command} ${args.join(" ")} in ${servicePath}`)

    const childProcess = spawn(command, args, {
      cwd: servicePath,
      stdio: ["inherit", "pipe", "pipe"],
      shell: process.platform === "win32",
    })

    let startupComplete = false

    // Handle stdout
    childProcess.stdout?.on("data", (data) => {
      const output = data.toString()
      console.log(`[${service.name}] ${output}`)

      // Look for Spring Boot startup completion indicators
      if (
        output.includes("Started") &&
        output.includes("Application") &&
        (output.includes("seconds") || output.includes("ms"))
      ) {
        if (!startupComplete) {
          startupComplete = true
          ui.success(`${service.name} started successfully!`)
          runningProcesses.push({ service, process: childProcess })
          resolve()
        }
      }
    })

    // Handle stderr
    childProcess.stderr?.on("data", (data) => {
      const output = data.toString()
      console.error(`[${service.name}] ERROR: ${output}`)
    })

    // Handle process exit
    childProcess.on("exit", (code, signal) => {
      if (code !== 0 && code !== null) {
        const error = `${service.name} exited with code ${code}`
        ui.error(error)
        if (!startupComplete) {
          reject(new Error(error))
        }
      }
    })

    // Handle process errors
    childProcess.on("error", (error) => {
      const errorMsg = `Failed to start ${service.name}: ${error.message}`
      ui.error(errorMsg)
      if (!startupComplete) {
        reject(new Error(errorMsg))
      }
    })

    // Timeout after 60 seconds if service doesn't start
    setTimeout(() => {
      if (!startupComplete) {
        const timeoutMsg = `${service.name} startup timed out after 60 seconds`
        ui.warning(timeoutMsg)
        startupComplete = true
        runningProcesses.push({ service, process: childProcess })
        resolve() // Continue with other services even if this one times out
      }
    }, 60000)
  })
}
