// Orca's host API has no "show my panel" method, so the worker asks the `orca` CLI to do it:
// `orca plugin open <plugin-key> --panel <id>`, the same command an author runs by hand.
import type { OrcaWorkerApi } from 'orca/worker'
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const MAC_APP_CLI = '/Applications/Orca.app/Contents/Resources/bin/orca'

/** The CLI candidates, best first: what Orca tells its children, the CLI next to the running
 *  app bundle, the usual install paths, then plain `orca` on PATH. */
export function cliCandidates(
  env: Record<string, string | undefined>,
  execPath: string
): string[] {
  const out: string[] = []
  if (env.ORCA_CLI_COMMAND) out.push(env.ORCA_CLI_COMMAND)
  if (env.ORCA_CLI_BIN_DIR) out.push(join(env.ORCA_CLI_BIN_DIR, 'orca'))
  const bundle = execPath.match(/^(.*?\.app)\/Contents\//)
  if (bundle) out.push(join(bundle[1], 'Contents/Resources/bin/orca'))
  out.push(MAC_APP_CLI, '/usr/local/bin/orca', '/opt/homebrew/bin/orca')
  if (env.HOME) out.push(join(env.HOME, '.local/bin/orca'))
  return [...new Set(out)]
}

export function resolveCli(): string {
  const found = cliCandidates(process.env, process.execPath).find((p) => existsSync(p))
  return found ?? 'orca'
}

function run(cli: string, args: string[], timeoutMs = 15_000): Promise<unknown> {
  return new Promise((resolvePromise, reject) => {
    execFile(cli, [...args, '--json'], { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024 }, (error, stdout) => {
      let parsed: { ok?: boolean; result?: unknown; error?: { code?: string; message?: string } } | null = null
      try {
        parsed = JSON.parse(String(stdout))
      } catch {
        parsed = null
      }
      if (parsed?.ok) return resolvePromise(parsed.result)
      const message = parsed?.error?.message ?? error?.message ?? 'orca CLI failed'
      reject(Object.assign(new Error(message), { code: parsed?.error?.code }))
    })
  })
}

type ListedPlugin = {
  pluginKey: string
  isDev?: boolean
  panels?: ({ id?: string } | string)[]
  source?: Record<string, unknown>
}

/** The plugin folder this worker was loaded from (src/.. of this file). */
export function pluginRoot(): string | null {
  try {
    return resolve(dirname(fileURLToPath(import.meta.url)), '..')
  } catch {
    return null
  }
}

/** Picks this plugin among `orca plugin list`: the one whose source names our folder, else the
 *  only one with id `pomodoro` and our panel (a dev load is `local.pomodoro`). */
export function pickPluginKey(plugins: ListedPlugin[], root: string | null, id: string, panelId: string): string | null {
  const hasPanel = (p: ListedPlugin) =>
    (p.panels ?? []).some((panel) => (typeof panel === 'string' ? panel : panel?.id) === panelId)
  const candidates = plugins.filter((p) => p.pluginKey.split('.').slice(1).join('.') === id && hasPanel(p))
  if (root) {
    const byPath = candidates.find((p) =>
      Object.values(p.source ?? {}).some((v) => typeof v === 'string' && resolve(v.replace(/^[a-z]+:/, '')) === root)
    )
    if (byPath) return byPath.pluginKey
  }
  if (candidates.length === 1) return candidates[0].pluginKey
  return candidates.find((p) => p.isDev)?.pluginKey ?? candidates[0]?.pluginKey ?? null
}

let cachedKey: string | null = null

export async function openPanelWithCli(orca: OrcaWorkerApi, panelId: string, id = 'pomodoro'): Promise<void> {
  const cli = resolveCli()
  if (!cachedKey) {
    const listed = (await run(cli, ['plugin', 'list'])) as { plugins?: ListedPlugin[] }
    cachedKey = pickPluginKey(listed.plugins ?? [], pluginRoot(), id, panelId)
    if (!cachedKey) throw new Error('plugin não encontrado em `orca plugin list`')
  }
  try {
    await run(cli, ['plugin', 'open', cachedKey, '--panel', panelId])
  } catch (error) {
    cachedKey = null
    throw error
  }
  orca.log(`opened panel ${cachedKey}/${panelId} via ${cli}`)
}
