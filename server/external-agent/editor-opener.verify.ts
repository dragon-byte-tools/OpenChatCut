import assert from 'node:assert/strict';
import { isLoopbackEditorUrl, openProjectEditor } from './editor-opener.ts';

const url = 'http://localhost:5199/#/editor/p1';
const noSleep = async () => {};

assert.equal(isLoopbackEditorUrl(url), true);
assert.equal(isLoopbackEditorUrl('http://127.0.0.1:5199/#/editor/p1'), true);
assert.equal(isLoopbackEditorUrl('http://[::1]:5199/'), true);
assert.equal(isLoopbackEditorUrl('https://evil.example/#/editor/p1'), false);
assert.equal(isLoopbackEditorUrl('http://user:pw@localhost:5199/'), false);
assert.equal(isLoopbackEditorUrl('file:///etc/passwd'), false);
assert.equal(isLoopbackEditorUrl('not a url'), false);

// Already open: no browser tab is added; the desktop opener is still called to focus the window.
{
  const opened: string[] = [];
  const result = await openProjectEditor('p1', url, {
    opener: null,
    isConnected: () => true,
    openBrowser: async (target) => { opened.push(target); },
  });
  assert.deepEqual(result, { projectId: 'p1', editorUrl: url, openedWith: 'already-open', connected: true });
  assert.deepEqual(opened, [], 'an open editor never gets a second browser tab');

  const focused: string[] = [];
  const desktop = await openProjectEditor('p1', url, {
    opener: async (id) => { focused.push(id); },
    isConnected: () => true,
  });
  assert.equal(desktop.openedWith, 'already-open');
  assert.deepEqual(focused, ['p1'], 'the desktop opener focuses the window already showing it');
}

// Desktop opener: called with the project id, then the editor connection is awaited.
{
  let polls = 0;
  const calls: string[] = [];
  const result = await openProjectEditor('p1', url, {
    opener: async (id) => { calls.push(id); },
    isConnected: () => polls++ >= 3,
    sleep: noSleep,
  });
  assert.deepEqual(calls, ['p1']);
  assert.equal(result.openedWith, 'desktop-window');
  assert.equal(result.connected, true, 'waits until the editor registers');
}

// No desktop opener: the default browser opens this server's loopback URL.
{
  const opened: string[] = [];
  let connected = false;
  const result = await openProjectEditor('p1', url, {
    opener: null,
    isConnected: () => connected,
    openBrowser: async (target) => { opened.push(target); connected = true; },
    sleep: noSleep,
  });
  assert.deepEqual(opened, [url]);
  assert.equal(result.openedWith, 'browser');
  assert.equal(result.connected, true);
}

// A non-loopback URL is never handed to the OS browser.
await assert.rejects(
  openProjectEditor('p1', 'https://evil.example/#/editor/p1', {
    opener: null,
    isConnected: () => false,
    openBrowser: async () => { throw new Error('must not open'); },
  }),
  /non-loopback/,
);

// An editor that never connects is reported, not thrown.
{
  const result = await openProjectEditor('p1', url, {
    opener: async () => {},
    isConnected: () => false,
    timeoutMs: 0,
    sleep: noSleep,
  });
  assert.equal(result.connected, false);
  assert.equal(result.openedWith, 'desktop-window');
}

// Headless ('none'): nothing opens and nothing waits.
{
  const result = await openProjectEditor('p1', url, {
    opener: 'none',
    isConnected: () => false,
    openBrowser: async () => { throw new Error('must not open'); },
  });
  assert.deepEqual(result, { projectId: 'p1', editorUrl: url, openedWith: 'not-opened', connected: false });
}

console.log('editor-opener.verify: open/focus/wait OK');
