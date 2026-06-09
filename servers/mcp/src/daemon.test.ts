import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  buildDaemonLogsCommand,
  buildLaunchAgentPlist,
  buildSystemdUserUnit,
  getDaemonLogs,
  loadBrijioEnv,
  parseDaemonCommand,
  planDaemonInstall,
  restartDaemon,
  startDaemon,
  stopDaemon
} from './daemon.js'

void describe('daemon command parsing', () => {
  void it('parses install ports as subcommand options', () => {
    const command = parseDaemonCommand(['install', '--ws-port', '9001', '--mcp-port', '9002'])

    assert.deepEqual(command, {
      name: 'install',
      wsPort: 9001,
      mcpPort: 9002
    })
  })

  void it('rejects invalid daemon ports', () => {
    assert.throws(
      () => parseDaemonCommand(['install', '--ws-port', 'not-a-port']),
      /Invalid --ws-port/
    )
  })

  void it('parses lifecycle subcommands', () => {
    assert.deepEqual(parseDaemonCommand(['start']), { name: 'start' })
    assert.deepEqual(parseDaemonCommand(['stop']), { name: 'stop' })
    assert.deepEqual(parseDaemonCommand(['restart']), { name: 'restart' })
  })

  void it('parses logs line count', () => {
    assert.deepEqual(parseDaemonCommand(['logs', '--lines', '25']), {
      name: 'logs',
      lines: 25,
      live: false
    })
    assert.deepEqual(parseDaemonCommand(['logs', '-n', '10']), {
      name: 'logs',
      lines: 10,
      live: false
    })
  })

  void it('parses live logs mode', () => {
    assert.deepEqual(parseDaemonCommand(['logs', '--live']), {
      name: 'logs',
      lines: 100,
      live: true
    })
    assert.deepEqual(parseDaemonCommand(['logs', '--live', '--lines', '25']), {
      name: 'logs',
      lines: 25,
      live: true
    })
  })

  void it('leaves interactive server args untouched', () => {
    assert.deepEqual(parseDaemonCommand(['--port', '8788']), {
      name: 'run',
      args: ['--port', '8788'],
      dev: false
    })
  })

  void it('parses --print-config without agent', () => {
    assert.deepEqual(parseDaemonCommand(['--print-config']), {
      name: 'print-config'
    })
  })

  void it('parses --print-config with agent', () => {
    assert.deepEqual(parseDaemonCommand(['--print-config', 'claude-desktop']), {
      name: 'print-config',
      agent: 'claude-desktop'
    })
  })

  void it('parses --print-config with agent alias', () => {
    assert.deepEqual(parseDaemonCommand(['--print-config', 'claude']), {
      name: 'print-config',
      agent: 'claude'
    })
  })

  void it('parses --print-config without agent when next arg is a flag', () => {
    assert.deepEqual(parseDaemonCommand(['--print-config', '--dev']), {
      name: 'print-config'
    })
  })

  void it('parses --doctor', () => {
    assert.deepEqual(parseDaemonCommand(['--doctor']), {
      name: 'doctor'
    })
  })

  void it('parses --dev flag for run mode', () => {
    assert.deepEqual(parseDaemonCommand(['--dev']), {
      name: 'run',
      args: [],
      dev: true
    })
  })

  void it('parses --dev flag with other run args', () => {
    assert.deepEqual(parseDaemonCommand(['--dev', '--port', '8788']), {
      name: 'run',
      args: ['--port', '8788'],
      dev: true
    })
  })

  void it('parses --help', () => {
    assert.deepEqual(parseDaemonCommand(['--help']), { name: 'help' })
  })

  void it('parses -h', () => {
    assert.deepEqual(parseDaemonCommand(['-h']), { name: 'help' })
  })
})

void describe('daemon env files', () => {
  void it('loads explicit env file before cwd and home fallback', () => {
    const root = mkdtempSync(join(tmpdir(), 'brijio-env-'))

    try {
      const cwd = join(root, 'cwd')
      const home = join(root, 'home')
      const explicit = join(root, 'custom.env')

      const loaded = loadBrijioEnv({
        cwd,
        home,
        envFile: explicit,
        readFile: (path) => {
          if (path === explicit) return 'MCP_HTTP_AUTH_TOKEN=explicit\n'
          if (path === join(cwd, '.env')) return 'MCP_HTTP_AUTH_TOKEN=cwd\n'
          if (path === join(home, '.brijio', '.env')) return 'MCP_HTTP_AUTH_TOKEN=home\n'
          throw new Error(`unexpected path ${path}`)
        },
        exists: () => true
      })

      assert.equal(loaded.path, explicit)
      assert.equal(loaded.values.MCP_HTTP_AUTH_TOKEN, 'explicit')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

void describe('daemon install planning', () => {
  void it('creates persistent tokens, writes requested ports, and preserves existing values', () => {
    const root = mkdtempSync(join(tmpdir(), 'brijio-install-'))

    try {
      const first = planDaemonInstall({
        platform: 'darwin',
        home: root,
        binaryPath: '/opt/brijio/bin/brijio',
        wsPort: 9010,
        mcpPort: 9011,
        tokenFactory: () => 'generated-token'
      })

      assert.equal(first.env.BRIJIO_PAIRING_TOKEN, 'generated-token')
      assert.equal(first.env.MCP_HTTP_AUTH_TOKEN, 'generated-token')
      assert.equal(first.env.WEBSOCKET_PORT, '9010')
      assert.equal(first.env.MCP_HTTP_PORT, '9011')
      assert.ok(first.serviceFilePath.endsWith('com.redvex.brijio.plist'))
      assert.ok(first.linkPath.endsWith('Library/LaunchAgents/com.redvex.brijio.plist'))

      const second = planDaemonInstall({
        platform: 'darwin',
        home: root,
        binaryPath: '/opt/brijio/bin/brijio',
        wsPort: 9020,
        tokenFactory: () => 'new-token'
      })

      assert.equal(second.env.BRIJIO_PAIRING_TOKEN, 'generated-token')
      assert.equal(second.env.MCP_HTTP_AUTH_TOKEN, 'generated-token')
      assert.equal(second.env.WEBSOCKET_PORT, '9020')
      assert.equal(second.env.MCP_HTTP_PORT, '9011')
      assert.equal(statSync(join(root, '.brijio', '.env')).mode & 0o777, 0o600)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  void it('writes service definitions without embedding secrets', () => {
    const root = mkdtempSync(join(tmpdir(), 'brijio-services-'))

    try {
      const plan = planDaemonInstall({
        platform: 'linux',
        home: root,
        binaryPath: '/opt/brijio/bin/brijio',
        tokenFactory: () => 'secret-token'
      })

      const unit = readFileSync(plan.serviceFilePath, 'utf8')

      assert.match(unit, /WorkingDirectory=%h\/\.brijio/)
      assert.match(unit, /EnvironmentFile=%h\/\.brijio\/\.env/)
      assert.doesNotMatch(unit, /secret-token/)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

void describe('daemon lifecycle controls', () => {
  void it('starts, stops, and restarts a macOS LaunchAgent', async () => {
    const calls: Array<{ command: string, args: string[] }> = []
    const runner = {
      execFile: async (command: string, args: string[]) => {
        calls.push({ command, args })
        return { stdout: '', stderr: '', code: 0 }
      }
    }
    const home = '/Users/alex'
    const plist = '/Users/alex/Library/LaunchAgents/com.redvex.brijio.plist'

    await startDaemon({ platform: 'darwin', home, runner })
    await stopDaemon({ platform: 'darwin', home, runner })
    await restartDaemon({ platform: 'darwin', home, runner })

    assert.deepEqual(calls, [
      { command: 'launchctl', args: ['load', plist] },
      { command: 'launchctl', args: ['unload', plist] },
      { command: 'launchctl', args: ['unload', plist] },
      { command: 'launchctl', args: ['load', plist] }
    ])
  })

  void it('starts, stops, and restarts a Linux systemd user unit', async () => {
    const calls: Array<{ command: string, args: string[] }> = []
    const runner = {
      execFile: async (command: string, args: string[]) => {
        calls.push({ command, args })
        return { stdout: '', stderr: '', code: 0 }
      }
    }

    await startDaemon({ platform: 'linux', home: '/home/alex', runner })
    await stopDaemon({ platform: 'linux', home: '/home/alex', runner })
    await restartDaemon({ platform: 'linux', home: '/home/alex', runner })

    assert.deepEqual(calls, [
      { command: 'systemctl', args: ['--user', 'start', 'brijio.service'] },
      { command: 'systemctl', args: ['--user', 'stop', 'brijio.service'] },
      { command: 'systemctl', args: ['--user', 'restart', 'brijio.service'] }
    ])
  })
})

void describe('daemon logs', () => {
  void it('tails the macOS log file', async () => {
    const root = mkdtempSync(join(tmpdir(), 'brijio-logs-'))

    try {
      const logPath = join(root, '.brijio', 'brijio.log')
      planDaemonInstall({
        platform: 'darwin',
        home: root,
        binaryPath: '/opt/brijio/bin/brijio',
        tokenFactory: () => 'generated-token'
      })
      writeFileSync(logPath, ['one', 'two', 'three', 'four'].join('\n'))

      assert.equal(await getDaemonLogs({ platform: 'darwin', home: root, lines: 2 }), 'three\nfour')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  void it('reads Linux user journal logs', async () => {
    const runner = {
      execFile: async (command: string, args: string[]) => {
        assert.equal(command, 'journalctl')
        assert.deepEqual(args, ['--user', '-u', 'brijio.service', '-n', '15', '--no-pager'])
        return { stdout: 'journal line\n', stderr: '', code: 0 }
      }
    }

    assert.equal(await getDaemonLogs({ platform: 'linux', home: '/home/alex', lines: 15, runner }), 'journal line\n')
  })

  void it('builds live log commands for macOS and Linux', () => {
    assert.deepEqual(buildDaemonLogsCommand({ platform: 'darwin', home: '/Users/alex', lines: 20, live: true }), {
      command: 'tail',
      args: ['-n', '20', '-f', '/Users/alex/.brijio/brijio.log']
    })
    assert.deepEqual(buildDaemonLogsCommand({ platform: 'linux', home: '/home/alex', lines: 20, live: true }), {
      command: 'journalctl',
      args: ['--user', '-u', 'brijio.service', '-n', '20', '--follow']
    })
  })
})

void describe('daemon service rendering', () => {
  void it('renders the macOS LaunchAgent with working directory, logs, and binary', () => {
    const plist = buildLaunchAgentPlist({
      home: '/Users/alex',
      binaryPath: '/Users/alex/.brijio/bin/brijio'
    })

    assert.match(plist, /<key>RunAtLoad<\/key>\n {2}<true\/>/)
    assert.match(plist, /<key>KeepAlive<\/key>\n {2}<true\/>/)
    assert.match(plist, /<string>\/Users\/alex\/\.brijio<\/string>/)
    assert.match(plist, /brijio\.log/)
  })

  void it('renders the Linux systemd user unit', () => {
    const unit = buildSystemdUserUnit()

    assert.match(unit, /ExecStart=%h\/\.brijio\/bin\/brijio/)
    assert.match(unit, /Restart=on-failure/)
    assert.match(unit, /WantedBy=default\.target/)
  })
})
