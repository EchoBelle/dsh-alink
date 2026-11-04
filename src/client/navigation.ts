import type { Context } from '@deepseek-ai/cordis';
import type { SessionId } from '@deepseek-ai/dsh-session/types';
import type {} from '@deepseek-ai/dsh-api-session-controller/client';
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client';
import type {} from '@deepseek-ai/dsh-client-ui-layout/client';
export async function openImportedSession(ctx: Context, id: string): Promise<void> {
  await ctx.sessions.refresh();
  ctx.uiWorkspace.openSession(id as SessionId);
  ctx.layout.selectPanel(null);
}
