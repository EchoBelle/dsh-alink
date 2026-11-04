import { openHarness } from '../helpers/browser.js';
import { expect, test } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
test.skip(!process.env.DSH_ALINK_PACKAGE_MATRIX, 'Clean package matrix only');
test('archiving after backup/preview blocks list, backup upload, commit and retry', async ({ page }) => {
  const root=process.env.DSH_ALINK_TEST_HOME!, {url}=JSON.parse(await readFile(path.join(root,'host.json'),'utf8'));
  const endpoint=new URL('/api/dsh-alink.rpc',url).href;
  await openHarness(page, url);
  await expect(page.getByRole('button',{name:'会话迁移',exact:true})).toBeVisible();
  const rpc=async (name:string,payload:unknown={})=>(await page.request.post(endpoint,{data:{endpoint:name,payload},headers:{Origin:new URL(url).origin}})).json();
  const list=await rpc('sessions',{app:'workbuddy'}); expect(list.ok).toBe(true);
  const target={cwd:root,agentPreset:'standard'};
  const preview=await rpc('preview',{sourceId:list.value.items[0].sourceId,target}); expect(preview.ok).toBe(true);
  const operations=await rpc('operations');
  const op=operations.value.find((o:{title:string})=>o.title==='活动会话 海星'); expect(op).toBeTruthy();
  const archive=await page.request.get(new URL('/api/dsh-alink.archive?operationId='+op.operationId,url).href);
  expect(archive.ok()).toBe(true);
  const file=path.join(root,'backup.zip');await writeFile(file,await archive.body());
  const registered=await rpc('registerFile',{path:file,format:'alink'});expect(registered.ok).toBe(true);
  const backupPreview=await rpc('preview',{sourceId:registered.value.sourceId,target});expect(backupPreview.ok).toBe(true);
  const importedBackup=await rpc('commit',{previewId:backupPreview.value.previewId,reportHash:backupPreview.value.report.reportHash,requestId:'active-backup'});
  expect(importedBackup).toMatchObject({ok:true,value:{state:'completed',targetSessionId:op.targetSessionId}});
  const db=new DatabaseSync(path.join(root,'sources/workbuddy/workbuddy.db'));
  try {
    db.exec("UPDATE sessions SET status='archived' WHERE id='active'");
    expect((await rpc('sessions',{app:'workbuddy'})).value.items).toEqual([]);
    for(const result of [
      await rpc('registerFile',{path:file,format:'alink'}),
      await rpc('preview',{sourceId:registered.value.sourceId,target}),
      await rpc('commit',{previewId:preview.value.previewId,reportHash:preview.value.report.reportHash,requestId:'archived-normal'}),
      await rpc('commit',{previewId:backupPreview.value.previewId,reportHash:backupPreview.value.report.reportHash,requestId:'archived-backup'}),
    ]) expect(result).toMatchObject({ok:false,error:{code:'SOURCE_INACTIVE'}});
    const oldPreview=await rpc('previewPage',{previewId:op.previewId});
    expect(await rpc('commit',{previewId:op.previewId,reportHash:oldPreview.value.preview.report.reportHash,requestId:'archived-retry'})).toMatchObject({ok:false,error:{code:'SOURCE_INACTIVE'}});
    await page.getByRole('button',{name:'会话迁移',exact:true}).click();
    await expect(page.getByRole('button',{name:'打开预览：活动会话 海星'})).toHaveCount(0);
    await page.getByText('从备份导入',{exact:true}).click();
    await page.getByLabel('备份文件').setInputFiles(file);
    await expect(page.getByRole('alert')).toContainText('原会话已归档');
  } finally { db.exec("UPDATE sessions SET status='completed' WHERE id='active'");db.close(); }
});
