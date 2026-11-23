import { execFile } from 'node:child_process';
import { isProjectConnected } from './broker.ts';

/**
 * Opens a project's editor so an MCP client can drive it. Most editing,
 * render and export tools need a live editor page; before this, an external
 * agent could only hand the user a URL and wait for them to open it.
 *
 * The desktop app registers an opener that shows the project in an app window
 * (the embedded server runs in the Electron main process). Without one — the
 * vite dev server — the default browser opens the editor URL.
 */
export type EditorOpener = (projectId: string) => Promise<void>;

/** `'none'` never opens anything: a headless run (the packaged smoke) keeps projects offline. */
export type EditorOpenerSetting = EditorOpener | 'none' | null;

let registeredOpener: EditorOpenerSetting = null;

/** Called by the desktop main process once its windows can be created. */
export function setEditorOpener(opener: EditorOpenerSetting): void {
  registeredOpener = opener;
}

export const EDITOR_CONNECT_TIMEOUT_MS = 20_000;
const EDITOR_CONNECT_POLL_MS = 250;
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export interface OpenProjectResult {
  projectId: string;
  editorUrl: string;
  /** How the editor was reached: already open, an app window, the default browser, or not opened (headless). */
  openedWith: 'already-open' | 'desktop-window' | 'browser' | 'not-opened';
  /** True once the editor page registered with this server; tools that need a live editor can run. */
  connected: boolean;
}

export interface OpenProjectDeps {
  opener?: EditorOpenerSetting;
  openBrowser?: (url: string) => Promise<void>;
  isConnected?: (projectId: string) => boolean;
  timeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

/** Only this server's own loopback editor may be opened in the user's browser. */
export function isLoopbackEditorUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:')
      && LOOPBACK_HOSTS.has(url.hostname)
      && !url.username && !url.password;
  } catch {
    return false;
  }
}

/** Opens `url` with the OS default handler; no shell is involved, so the URL is one argument. */
export function openInDefaultBrowser(url: string): Promise<void> {
  const [command, args] = process.platform === 'darwin'
    ? ['open', [url]]
    : process.platform === 'win32'
      ? ['rundll32', ['url.dll,FileProtocolHandler', url]]
      : ['xdg-open', [url]];
  return new Promise((resolve, reject) => {
    execFile(command, args as string[], (error) => (error ? reject(error) : resolve()));
  });
}

export async function openProjectEditor(
  projectId: string,
  editorUrl: string,
  deps: OpenProjectDeps = {},
): Promise<OpenProjectResult> {
  const isConnected = deps.isConnected ?? isProjectConnected;
  const opener = deps.opener === undefined ? registeredOpener : deps.opener;
  if (isConnected(projectId)) {
    // The desktop opener focuses the window already showing it; a browser tab cannot be focused, so none is opened.
    if (typeof opener === 'function') await opener(projectId);
    return { projectId, editorUrl, openedWith: 'already-open', connected: true };
  }
  if (opener === 'none') return { projectId, editorUrl, openedWith: 'not-opened', connected: false };

  let openedWith: OpenProjectResult['openedWith'];
  if (opener) {
    await opener(projectId);
    openedWith = 'desktop-window';
  } else {
    if (!isLoopbackEditorUrl(editorUrl)) throw new Error(`refusing to open a non-loopback editor URL: ${editorUrl}`);
    await (deps.openBrowser ?? openInDefaultBrowser)(editorUrl);
    openedWith = 'browser';
  }

  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const deadline = Date.now() + (deps.timeoutMs ?? EDITOR_CONNECT_TIMEOUT_MS);
  let connected = isConnected(projectId);
  while (!connected && Date.now() < deadline) {
    await sleep(EDITOR_CONNECT_POLL_MS);
    connected = isConnected(projectId);
  }
  return { projectId, editorUrl, openedWith, connected };
}
