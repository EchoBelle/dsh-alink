import type { Context } from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client';
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client';
import type {} from '@deepseek-ai/dsh-client-ui-layout/client';
import { MigrationPanel } from './MigrationPanel.js';
import css from './styles.css';
export const name = 'dsh-alink-client';
export const inject = ['slots', 'connection', 'sessions', 'uiWorkspace', 'layout'];
export function apply(ctx: Context): void {
  ctx.effect(() => { const style = document.createElement('style'); style.dataset.plugin = 'dsh-alink'; style.textContent = css; document.head.append(style); return () => style.remove(); });
  ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: 'dsh-alink' }, () => <MigrationPanel ctx={ctx} />));
  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({ name: 'sidebar.panellist', id: 'dsh-alink', label: 'Alink', order: 50 }, () => <span aria-hidden="true">⇥</span>));
}
