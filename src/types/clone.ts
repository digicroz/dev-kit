export type osTypes =
  | 'aix'
  | 'android'
  | 'darwin'
  | 'freebsd'
  | 'linux'
  | 'openbsd'
  | 'sunos'
  | 'win32'
  | 'cygwin';

export type Clone = {
  os: osTypes;
  baseDir: string;
};

export type CloneConfig = {
  version: string;
  clones: Clone[];
};
