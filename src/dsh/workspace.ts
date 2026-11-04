import type { WorkspaceRegistry } from '@deepseek-ai/dsh-workspace';
import { SessionId } from '@deepseek-ai/dsh-session';
export async function attachWorkspace(registry: WorkspaceRegistry, cwd: string, sessionId: string): Promise<void> {
  const workspace = await registry.create(cwd);
  await workspace.attachSession(SessionId(sessionId));
}
