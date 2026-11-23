/**
 * Auto-apply (YOLO) is the only mode: proposals always apply automatically. The
 * system prompt reads it through this module-level registry without threading
 * React props through the agent run loop. It starts true so a run that begins
 * before the composer mounts is auto as well.
 */
let autoApply = true;

export function setAgentAutoApply(value: boolean): void {
  autoApply = value;
}

export function agentAutoApply(): boolean {
  return autoApply;
}
