import { BrowserWindow, Menu, screen, shell } from 'electron';
import { buildTextContextMenuTemplate } from './context-menu.ts';
import { chooseEditorWindow, editorPageUrl } from './editor-window-choice.ts';
import { resolveDesktopPageUrlDecision } from './page-origin.ts';
import type { DesktopPageUrlDecision, DesktopPageUrlSurface } from './page-origin.ts';
import { focusExistingWindow } from './single-instance.ts';
import { applyDesktopWindowFrame, desktopWindowFrameOptions } from './window-frame.ts';
import { installResponsiveWindowScale, resolveInitialDesktopWindowBounds } from './window-scale.ts';
import { installWindowsRendererRecovery } from './window-recovery.ts';

function handOffExternalUrl(decision: DesktopPageUrlDecision): void {
  if (decision.action !== 'open-external') return;
  void shell.openExternal(decision.url).catch((error: unknown) => {
    console.error('[desktop] failed to open external URL:', error);
  });
}

export function installDesktopPageGuards(win: BrowserWindow, trustedOrigin: string): void {
  const guardNavigation = (surface: Extract<DesktopPageUrlSurface, 'navigation' | 'redirect'>) => (
    event: { preventDefault(): void },
    requestedUrl: string,
  ): void => {
    const decision = resolveDesktopPageUrlDecision(requestedUrl, trustedOrigin, surface);
    if (decision.action === 'allow') return;
    event.preventDefault();
    handOffExternalUrl(decision);
  };

  win.webContents.on('will-navigate', guardNavigation('navigation'));
  win.webContents.on('will-redirect', guardNavigation('redirect'));
  win.webContents.setWindowOpenHandler(({ url }) => {
    const decision = resolveDesktopPageUrlDecision(url, trustedOrigin, 'popup');
    handOffExternalUrl(decision);
    return { action: 'deny' };
  });
}

/**
 * One app window (the main window, or an extra project window): the same frame,
 * scale, renderer recovery, navigation guards and context menu everywhere, so a
 * project opened by an MCP client behaves exactly like the main window.
 */
export function createAppWindow(trustedOrigin: string, preloadPath: string, show = true): BrowserWindow {
  const win = new BrowserWindow({
    ...resolveInitialDesktopWindowBounds(screen.getPrimaryDisplay().workArea),
    show,
    backgroundColor: '#111111',
    title: 'OpenChatCut',
    ...desktopWindowFrameOptions(),
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      // The editor bridge heartbeat is a timer-driven long poll; throttling a
      // background window would drop its MCP connection.
      backgroundThrottling: false,
    },
  });
  applyDesktopWindowFrame(win);
  installResponsiveWindowScale(win);
  const uninstallRendererRecovery = installWindowsRendererRecovery(win);
  win.once('closed', uninstallRendererRecovery);
  installDesktopPageGuards(win, trustedOrigin);
  win.webContents.on('context-menu', (_event, params) => {
    const template = buildTextContextMenuTemplate(params);
    if (!template.length) return;
    Menu.buildFromTemplate(template).popup({ window: win });
  });
  return win;
}

/** Shows a project in an app window, following `chooseEditorWindow`. */
export async function openProjectWindow(trustedOrigin: string, preloadPath: string, projectId: string): Promise<void> {
  const windows = BrowserWindow.getAllWindows().filter((win) => !win.isDestroyed());
  const choice = chooseEditorWindow(windows.map((win) => win.webContents.getURL()), trustedOrigin, projectId);
  const url = editorPageUrl(trustedOrigin, projectId);
  if (choice.action === 'focus') {
    focusExistingWindow(windows[choice.index]);
    return;
  }
  const win = choice.action === 'navigate' ? windows[choice.index] : createAppWindow(trustedOrigin, preloadPath);
  await win.loadURL(url);
  focusExistingWindow(win);
}
