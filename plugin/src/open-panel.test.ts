import { assert, test } from 'orca/testing'
import { cliCandidates, pickPluginKey } from './open-panel.ts'

test('prefers ORCA_CLI_COMMAND, then the CLI inside the running app bundle', () => {
  const list = cliCandidates(
    { ORCA_CLI_COMMAND: '/x/orca', HOME: '/Users/me' },
    '/Applications/Orca.app/Contents/Frameworks/Orca Helper.app/Contents/MacOS/Orca Helper'
  )
  assert.equal(list[0], '/x/orca')
  assert.equal(list[1], '/Applications/Orca.app/Contents/Resources/bin/orca')
  assert.ok(list.includes('/Users/me/.local/bin/orca'))
  assert.equal(new Set(list).size, list.length)
})

test('finds this plugin in `orca plugin list`', () => {
  const plugins = [
    { pluginKey: 'acme.pomodoro', panels: [{ id: 'other' }] },
    { pluginKey: 'local.pomodoro', isDev: true, panels: [{ id: 'pomodoro' }], source: { kind: 'dev', path: '/work/pomodoro' } },
    { pluginKey: 'someone.pomodoro', panels: [{ id: 'pomodoro' }], source: { kind: 'git' } }
  ]
  assert.equal(pickPluginKey(plugins, '/work/pomodoro', 'pomodoro', 'pomodoro'), 'local.pomodoro')
  assert.equal(pickPluginKey(plugins, '/elsewhere', 'pomodoro', 'pomodoro'), 'local.pomodoro')
  assert.equal(pickPluginKey([plugins[2]], null, 'pomodoro', 'pomodoro'), 'someone.pomodoro')
  assert.equal(pickPluginKey([], null, 'pomodoro', 'pomodoro'), null)
})
