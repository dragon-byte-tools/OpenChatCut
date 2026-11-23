// Which app window shows a project opened by an MCP client. Electron-free so the
// verify script can drive it; editor-windows.ts applies the choice.

export type EditorWindowChoice =
  | { action: 'focus'; index: number }
  | { action: 'navigate'; index: number }
  | { action: 'create' };

/** The project id an app page shows (`#/editor/<id>`), or null for the dashboard and other pages. */
export function editorProjectIdOf(pageUrl: string, trustedOrigin: string): string | null {
  let url: URL;
  try {
    url = new URL(pageUrl);
  } catch {
    return null;
  }
  if (url.origin !== new URL(trustedOrigin).origin) return null;
  const match = url.hash.match(/^#\/editor\/(.+)$/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function isDashboardPage(pageUrl: string, trustedOrigin: string): boolean {
  try {
    const url = new URL(pageUrl);
    // The floating transcript window is the app origin too, but never an editor host.
    return url.origin === new URL(trustedOrigin).origin
      && !url.searchParams.has('transcript-window')
      && editorProjectIdOf(pageUrl, trustedOrigin) === null;
  } catch {
    return false;
  }
}

/**
 * Where a project opens: the window already showing it, else a window still on
 * the dashboard, else a new window — a window showing another project is never
 * switched, so an agent editing that project is not cut off.
 */
export function chooseEditorWindow(pageUrls: readonly string[], trustedOrigin: string, projectId: string): EditorWindowChoice {
  const showing = pageUrls.findIndex((url) => editorProjectIdOf(url, trustedOrigin) === projectId);
  if (showing >= 0) return { action: 'focus', index: showing };
  const dashboard = pageUrls.findIndex((url) => isDashboardPage(url, trustedOrigin));
  if (dashboard >= 0) return { action: 'navigate', index: dashboard };
  return { action: 'create' };
}

export function editorPageUrl(trustedOrigin: string, projectId: string): string {
  return `${trustedOrigin.replace(/\/+$/, '')}/#/editor/${encodeURIComponent(projectId)}`;
}
