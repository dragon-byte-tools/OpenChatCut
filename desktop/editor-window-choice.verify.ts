import assert from 'node:assert/strict';
import { chooseEditorWindow, editorPageUrl, editorProjectIdOf } from './editor-window-choice.ts';

const origin = 'http://127.0.0.1:5199';
const dashboard = `${origin}/`;
const projectA = `${origin}/#/editor/aaa-111`;
const projectB = `${origin}/#/editor/bbb-222`;
const transcript = `${origin}/?transcript-window=1`;

assert.equal(editorPageUrl(origin, 'aaa-111'), projectA);
assert.equal(editorPageUrl(`${origin}/`, 'a b'), `${origin}/#/editor/a%20b`, 'ids are encoded and the origin slash is not doubled');
assert.equal(editorProjectIdOf(projectA, origin), 'aaa-111');
assert.equal(editorProjectIdOf(`${origin}/#/editor/a%20b`, origin), 'a b', 'encoded ids decode back');
assert.equal(editorProjectIdOf(dashboard, origin), null);
assert.equal(editorProjectIdOf('https://evil.example/#/editor/aaa-111', origin), null, 'another origin never counts as an editor');
assert.equal(editorProjectIdOf('not a url', origin), null);

assert.deepEqual(
  chooseEditorWindow([projectB, projectA], origin, 'aaa-111'),
  { action: 'focus', index: 1 },
  'a window already showing the project is focused',
);
assert.deepEqual(
  chooseEditorWindow([projectB, dashboard], origin, 'aaa-111'),
  { action: 'navigate', index: 1 },
  'a window on the dashboard is reused',
);
assert.deepEqual(
  chooseEditorWindow([projectB], origin, 'aaa-111'),
  { action: 'create' },
  'a window showing another project is never switched',
);
assert.deepEqual(
  chooseEditorWindow([transcript], origin, 'aaa-111'),
  { action: 'create' },
  'the transcript window is never used as an editor',
);
assert.deepEqual(chooseEditorWindow([], origin, 'aaa-111'), { action: 'create' });

console.log('editor-window-choice.verify: window choice OK');
