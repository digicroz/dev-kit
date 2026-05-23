export type osTypes =
  | "aix"
  | "android"
  | "darwin" // macOS
  | "freebsd"
  | "linux"
  | "openbsd"
  | "sunos"
  | "win32" // Windows
  | "cygwin";

export interface Clone {
  os: osTypes;
  baseDir: string;
}

export interface CloneConfig {
  version: string;
  clones: Clone[];
}
