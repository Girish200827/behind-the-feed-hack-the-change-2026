// Preload: a small, typed bridge. The renderer can only ask the main process to (1) post a Circle message to a
// Discord webhook and (2) show a native notification. Data still comes from Allen's local API over HTTP.
import { contextBridge, ipcRenderer } from 'electron'
import type { DiscordPayload, BehindFeedBridge } from '../src/types/bridge'

const bridge: BehindFeedBridge = {
  sendToCircle: (webhookUrl: string, payload: DiscordPayload) => ipcRenderer.invoke('circle:send', webhookUrl, payload),
  notify: (title: string, body: string) => ipcRenderer.invoke('notify', title, body)
}

contextBridge.exposeInMainWorld('behindfeed', bridge)
