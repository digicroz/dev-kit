export type DKProjectType =
  | 'node-express'
  | 'node-fastify'
  | 'tanstack-start'
  | 'vite-react'
  | 'react-native-cli'
  | 'react-native-expo'
  | 'spring-boot-microservice'
  | 'nextjs'
  | 'angular'
  | 'unknown'
  | 'npm-package';

export type DatabaseType = 'mysql' | 'postgres' | 'sqlite' | 'mongodb';

export type DatabaseConfig = {
  dumpsDir?: string;
  migrationsDir?: string;
  dbUrlEnvName?: string;
  dbName?: string;
  dbType?: DatabaseType;
};

export type SpringBootService = {
  name: string;
  path: string;
  startingOrderIndex: number;
};

export type SpringBootConfig = {
  services: SpringBootService[];
  buildOutDir?: string;
};

export type AssetGeneratorConfig = {
  baseDir: string;
  nameCase?: 'kebab-case' | 'snake_case' | 'any';
  infoComment?: 'hidden' | 'short_info';
};

export type AssetsGeneratorConfig = {
  baseDir: string;
  publicDir?: string;
  image?: AssetGeneratorConfig;
  svg?: AssetGeneratorConfig;
};

export type GeneratorsConfig = {
  assets?: AssetsGeneratorConfig;
};

export type AssetsTypeGeneratorConfig = {
  imagesDir: string;
  imageNameCase?: 'kebab-case' | 'snake_case' | 'any';
  infoComment?: 'hidden' | 'short_info';
};

export type DKConfig = {
  version: number;
  projectType: DKProjectType;
  database?: DatabaseConfig;
  springBoot?: SpringBootConfig;
  generators?: GeneratorsConfig;
  assetsTypeGenerator?: AssetsTypeGeneratorConfig;
};

export const DK_CONFIG_LATEST_VERSION = 1;
