// Electron main process: opens the dashboard window. Nothing else.
// No camera, no screen capture, no window detection here (those belong to Raad, Giresh and Allen).
import { app, BrowserWindow, nativeTheme, shell } from 'electron'
import { join } from 'node:path'

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
    title: 'Scroll Mood',
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
      sandbox: true
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

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
