// Minimal typings for the few Node built-ins the worker uses (the plugin ships no @types/node).
declare module 'node:child_process' {
  export function execFile(
    file: string,
    args: readonly string[],
    options: { timeout?: number; maxBuffer?: number },
    callback: (error: (Error & { code?: unknown }) | null, stdout: string, stderr: string) => void
  ): unknown
}
declare module 'node:fs' {
  export function existsSync(path: string): boolean
  export function readFileSync(path: string | URL, encoding: 'utf8'): string
}
declare module 'node:url' {
  export function fileURLToPath(url: string | URL): string
}
declare module 'node:path' {
  export function join(...parts: string[]): string
  export function resolve(...parts: string[]): string
  export function dirname(path: string): string
}
declare var process: {
  env: Record<string, string | undefined>
  execPath: string
}
