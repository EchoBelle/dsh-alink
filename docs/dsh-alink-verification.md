# dsh-alink 验证记录

当前固定适配 DSH 0.2.1-rc.5、Node 24.14.0，验收平台为 macOS Apple Silicon。

重命名后的迁移实现通过 28 项单元、14 项原生服务集成、7 项浏览器验收；5 条会话分别通过重启续聊和移除插件后的续聊。测试使用合成数据、真实 DSH 运行时及本地测试模型。

归档防护覆盖来源列表、捕获、备份注册、预览、提交和重试。备份的对象路径必须带合法哈希且位于归档边界内；崩溃遗留操作会变为可恢复状态并保留原目标 ID；NULL、空及未知归档状态不会视为有效。

GitHub 安装的独立验证结果见 [GitHub 安装与验收](github-installation.md)。

```sh
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:package
node scripts/release-smoke.mjs .local/releases/dsh-alink-0.1.0.tgz
```

完整浏览器验收需要本机 Google Chrome。所有测试都使用隔离 DSH_HOME，不迁移日常会话，不调用真实模型服务。
