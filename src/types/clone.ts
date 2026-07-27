export type osTypes =
  | "aix"
  | "android"
  | "darwin" 
  | "freebsd"
  | "linux"
  | "openbsd"
  | "sunos"
  | "win32" 
  | "cygwin";

export interface Clone {
  os: osTypes;
  baseDir: string;
}

export interface CloneConfig {
  version: string;
  clones: Clone[];
}
