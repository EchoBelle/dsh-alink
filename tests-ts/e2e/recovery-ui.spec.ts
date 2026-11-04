import { openHarness } from '../helpers/browser.js';
import { expect, test } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
test.skip(!process.env.DSH_ALINK_PACKAGE_MATRIX, 'Clean package matrix only');
test('a killed writer exposes recovery in the UI and archived sources still cannot retry', async ({ page }) => {
  const root=process.env.DSH_ALINK_TEST_HOME!, {url}=JSON.parse(await readFile(path.join(root,'host.json'),'utf8'));
  const wb=path.join(root,'sources/workbuddy');
  const db=new DatabaseSync(path.join(wb,'workbuddy.db'));
  db.prepare('INSERT INTO sessions VALUES (?,?,?,?,?,?)').run('recovery','恢复入口验收',root,'completed',null,1);
  await writeFile(path.join(wb,'projects/p/recovery.jsonl'),JSON.stringify({type:'message',role:'user',sessionId:'recovery',content:'恢复入口验收'})+'\n');
  await openHarness(page, url);await expect(page.getByRole('button',{name:'会话迁移',exact:true})).toBeVisible();
  const endpoint=new URL('/api/dsh-alink.rpc',url).href;
  const rpc=async (name:string,payload:unknown={})=>(await page.request.post(endpoint,{data:{endpoint:name,payload},headers:{Origin:new URL(url).origin}})).json();
  const list=await rpc('sessions',{app:'workbuddy'}), source=list.value.items.find((s:{nativeId:string})=>s.nativeId==='recovery');
  const preview=(await rpc('preview',{sourceId:source.sourceId,target:{cwd:root,agentPreset:'standard'}})).value;
  const key=createHash('sha256').update(JSON.stringify({snapshot:preview.snapshotDigest,target:preview.target,mapping:'1',namespace:root})).digest('hex');
  const resultFile=path.join(root,'crash-reservation.json');
  const child=spawn(process.execPath,[path.join(root,'crash-reservation.mjs'),path.join(root,'link-data/operations.sqlite'),preview.previewId,key,resultFile],{stdio:'pipe'});
  const [code,signal]=await once(child,'exit');expect(code).toBeNull();expect(signal).toBe('SIGKILL');
  const reserved=JSON.parse(await readFile(resultFile,'utf8'));
  try {
    await page.getByRole('button',{name:'会话迁移',exact:true}).click();
    const row=page.getByRole('region',{name:'迁移记录'}).locator('article').filter({has:page.getByText('恢复入口验收',{exact:true})}).first();
    await expect(row.getByText('需要核对',{exact:true})).toBeVisible();
    await expect(row.getByRole('button',{name:'重新核对并重试'})).toBeEnabled();
    db.exec("UPDATE sessions SET status='archived' WHERE id='recovery'");
    await row.getByRole('button',{name:'重新核对并重试'}).click();
    await expect(page.getByRole('alert')).toContainText('原会话已归档');
    db.exec("UPDATE sessions SET status='completed' WHERE id='recovery'");
    await row.getByRole('button',{name:'重新核对并重试'}).click();
    await expect(row.getByText('迁移完成',{exact:true})).toBeVisible({timeout:30000});
    const current=await rpc('operation',{operationId:reserved.operationId});expect(current.value.targetSessionId).toBe(reserved.targetSessionId);
  } finally { db.close(); }
});
