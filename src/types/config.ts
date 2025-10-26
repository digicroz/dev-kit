export type DKProjectType =
  | "node-express"
  | "vite-react"
  | "react-native-cli"
  | "spring-boot-microservice"
  | "nextjs"

export type DatabaseType = "mysql" | "postgres" | "sqlite" | "mongodb"

export interface DatabaseConfig {
  dumpsDir?: string
  migrationsDir?: string
  dbUrlEnvName?: string
  dbName?: string
  dbType?: DatabaseType
}

export interface SpringBootService {
  name: string
  path: string
  startingOrderIndex: number
}

export interface SpringBootConfig {
  services: SpringBootService[]
}

export interface AssetGeneratorConfig {
  baseDir: string
  nameCase?: "kebab-case" | "snake_case" | "any"
  infoComment?: "hidden" | "short_info"
}

export interface AssetsGeneratorConfig {
  baseDir: string
  image?: AssetGeneratorConfig
  svg?: AssetGeneratorConfig
}

export interface GeneratorsConfig {
  assets?: AssetsGeneratorConfig
}

export interface AssetsTypeGeneratorConfig {
  imagesDir: string
  imageNameCase?: "kebab-case" | "snake_case" | "any"
  infoComment?: "hidden" | "short_info"
}

export interface DKConfig {
  version: number
  projectType: DKProjectType
  database?: DatabaseConfig
  springBoot?: SpringBootConfig
  generators?: GeneratorsConfig
  assetsTypeGenerator?: AssetsTypeGeneratorConfig
}

export const DK_CONFIG_LATEST_VERSION = 1
