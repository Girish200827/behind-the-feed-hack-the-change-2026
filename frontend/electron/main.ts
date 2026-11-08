// Electron main process: opens the dashboard window, posts Circle messages to Discord and shows notifications.
// No camera, no screen capture, no window detection here (those belong to Raad, Giresh and Allen).
import { app, BrowserWindow, ipcMain, nativeTheme, Notification, shell } from 'electron'
import { execFile, spawn, type ChildProcess } from 'node:child_process'
import { appendFileSync, closeSync, mkdirSync, openSync } from 'node:fs'
import { join } from 'node:path'
import { sendWebhook } from './discord'

// ---- Engine: the installed app carries the Python half (backend + camera + screen) as one program,
// resources/engine/behindfeed-engine. In development launch.py starts those parts instead, so this only
// runs when packaged. Data goes to the user-data folder (macOS: ~/Library/Application Support/BehindFeed).
const API_URL = 'http://127.0.0.1:8000'
const ENGINE_WAIT_MS = 20_000
let engine: ChildProcess | null = null

// The installed app keeps its data in ".../BehindFeed", not under the npm package name.
if (app.isPackaged) app.setPath('userData', join(app.getPath('appData'), 'BehindFeed'))

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function backendUp(): Promise<boolean> {
  try {
    return (await fetch(`${API_URL}/status`, { signal: AbortSignal.timeout(800) })).ok
  } catch {
    return false
  }
}

async function startEngine(): Promise<void> {
  if (!app.isPackaged || process.env['BEHINDFEED_NO_ENGINE']) return
  if (await backendUp()) return // a backend is already running (e.g. launch.py): use it
  const home = app.getPath('userData')
  mkdirSync(home, { recursive: true })
  const exe = join(process.resourcesPath, 'engine', process.platform === 'win32' ? 'behindfeed-engine.exe' : 'behindfeed-engine')
  const logPath = join(home, 'engine.log')
  appendFileSync(logPath, `\n=== ${new Date().toISOString()} starting ${exe}\n`)
  // Output goes straight into the log file (not through a pipe to us), so the engine and its camera
  // process can still write while they shut down after this app has already exited.
  const out = openSync(logPath, 'a')
  engine = spawn(exe, ['--home', home, '--parent-pid', String(process.pid)], {
    cwd: home,
    env: { ...process.env, BEHINDFEED_HOME: home },
    windowsHide: true,
    detached: process.platform !== 'win32', // own process group on macOS, so quitting reaches the camera process too
    stdio: ['ignore', out, out]
  })
  closeSync(out)
  engine.on('error', (e) => appendFileSync(logPath, `engine failed to start: ${e.message}\n`))
  engine.on('exit', () => {
    engine = null
  })
  // The first start after installing can be slow while the OS checks the files; the dashboard shows demo
  // data with an "offline" banner until the backend answers, then switches over by itself.
  const end = Date.now() + ENGINE_WAIT_MS
  while (Date.now() < end && engine && !(await backendUp())) await sleep(400)
}

function stopEngine(): void {
  const p = engine
  if (!p || p.exitCode !== null || p.pid === undefined) return
  if (process.platform === 'win32') {
    execFile('taskkill', ['/PID', String(p.pid), '/T', '/F'])
    return
  }
  // Ctrl+C to the whole group: the camera process sends its last events, the engine stops the backend.
  try {
    process.kill(-p.pid, 'SIGINT')
  } catch {
    p.kill('SIGTERM')
  }
}

app.on('before-quit', stopEngine)

// Windows only shows native notifications for apps with an AppUserModelID.
app.setAppUserModelId('com.behindfeed.app')

// Circle: the renderer can't call Discord directly (CORS), so it asks us. URL and payload are validated in sendWebhook.
ipcMain.handle('circle:send', (_e, url: unknown, payload: unknown) => sendWebhook(String(url ?? ''), payload))

// Connect-instead nudges: a gentle native notification.
ipcMain.handle('notify', (_e, title: unknown, body: unknown) => {
  if (!Notification.isSupported()) return
  new Notification({ title: String(title).slice(0, 80), body: String(body).slice(0, 240), silent: false }).show()
})

// Keep in sync with --bg / --muted / --titlebar-h in src/index.css.
const THEME = {
  dark: { bg: '#07080c', symbols: '#8890a3' },
  light: { bg: '#f5f6f9', symbols: '#5d6578' }
}
const TITLEBAR_HEIGHT = 40

const currentTheme = () => (nativeTheme.shouldUseDarkColors ? THEME.dark : THEME.light)

function createWindow(): void {
  const theme = currentTheme()
  const win = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 1100,
    minHeight: 720,
    title: 'BehindFeed',
    backgroundColor: theme.bg,
    show: false,
    titleBarStyle: 'hidden',
    // Windows/Linux draw native min/max/close over our own title strip.
    ...(process.platform !== 'darwin'
      ? { titleBarOverlay: { color: theme.bg, symbolColor: theme.symbols, height: TITLEBAR_HEIGHT } }
      : { trafficLightPosition: { x: 16, y: 13 } }),
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      sandbox: true,
      // Keep timers and animations running when the window is covered, so live data keeps refreshing (Phase 3).
      backgroundThrottling: false
    }
  })

  win.once('ready-to-show', () => win.show())

  nativeTheme.on('updated', () => {
    const t = currentTheme()
    win.setBackgroundColor(t.bg)
    if (process.platform !== 'darwin') win.setTitleBarOverlay({ color: t.bg, symbolColor: t.symbols })
  })

  // Open external links in the user's browser, never inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  await startEngine()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
