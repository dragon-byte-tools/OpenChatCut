import assert from 'node:assert/strict';
import { agentAutoApply, setAgentAutoApply } from './approval-mode';

// Auto-apply is the only mode, so the registry is already auto before the
// composer syncs. It drives prompt/proposal behavior, not tool execution.
assert.equal(agentAutoApply(), true, 'the unsynced registry initializes to auto mode');
setAgentAutoApply(false);
assert.equal(agentAutoApply(), false, 'the registry still follows an explicit sync');
setAgentAutoApply(true);
assert.equal(agentAutoApply(), true, 'the registry returns to auto mode');

console.log('approval-mode.verify: preference registry OK');
