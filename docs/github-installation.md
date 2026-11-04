# GitHub 安装与验收

仓库：[EchoBelle/dsh-alink](https://github.com/EchoBelle/dsh-alink)。插件需要 DSH 0.2.1-rc.5 和 Node.js 24.14+（24 系列）。

```sh
dsh --profile web --dump-config
dsh plugin --profile web add --workspace-root github:EchoBelle/dsh-alink#v0.1.2
dsh web
```

仓库跟踪源码和预构建 lib，GitHub 安装不执行 prepare/prepack 构建。修改源码后须运行 build 并提交对应 lib。

## 0.1.2 验收

`v0.1.2` 已通过 GitHub 固定标签的全新安装验收，使用官方未修改的 DSH 0.2.1-rc.5。安装通过 `dsh plugin` 完成，预构建文件与本地发布产物逐字节一致。

29 项单元测试、14 项集成测试、10 项浏览器检查通过。覆盖项目分组、仅展示对话正文、旧预览过滤、长内容、下拉箭头间距和 1440/900/600 像素布局；归档后的列表、备份、提交和重试均被拦截。5 条迁入会话在重启后和卸载插件后分别续聊成功，共 10 次本地测试模型调用。

当前版本仅优化 Alink，不修改 DSH 安装器或用户包管理设置。

## 0.1.0 的历史验收

2026-11-04，macOS Apple Silicon，DSH 0.2.1-rc.5，Node 24.14.0。

- 使用 EchoBelle 账号发布公开仓库。
- 通过 DSH 的 plugin 命令，在工作区之外的新 DSH_HOME 安装 GitHub 固定提交。
- 安装依赖确认为 GitHub 来源；主端、前端、worker 构建文件与提交内容逐字节一致。
- 7 项浏览器测试通过：四种外部来源、旧 DSH 文件、有效备份去重、归档防护、异常退出后的界面恢复。
- 5 条迁入会话重启后分别续聊成功；卸载插件后再次分别续聊成功。10 次请求均使用本地测试模型，结果落盘并重新读取通过。
- 重命名后 28 项单元测试、14 项集成测试和 TypeScript 检查通过。

完整流程验证的提交为 [`1447d7c088a822de3e0d7c29cc1e371553cc5bb8`](https://github.com/EchoBelle/dsh-alink/commit/1447d7c088a822de3e0d7c29cc1e371553cc5bb8)。后续标签提交仅更新验证文档，运行产物不变。`v0.1.0` 标签随后也通过同样的完整流程复测：7 项浏览器测试、5 次重启续聊、5 次卸载后续聊全部通过。

## 复现当前版本

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
node scripts/release-smoke.mjs github:EchoBelle/dsh-alink#v0.1.2
```

需要本机 Google Chrome。验收使用合成来源和本地测试模型，不迁移日常会话，不发起真实模型请求。结果保存在 .local/releases/latest-smoke.json，日志位于 .local/verification。
