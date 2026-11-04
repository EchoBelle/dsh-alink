# GitHub 安装与验收

仓库：[EchoBelle/dsh-alink](https://github.com/EchoBelle/dsh-alink)。插件需要 DSH 0.2.1-rc.5 和 Node.js 24.14+（24 系列）。

```sh
dsh --profile web --dump-config
dsh plugin --profile web add --workspace-root github:EchoBelle/dsh-alink#v0.2.2
dsh web
```

仓库跟踪源码和预构建 lib，GitHub 安装不执行 prepare/prepack 构建。修改源码后须运行 build 并提交对应 lib。

## 0.2.2 验收

修复多选只能展示最后一条会话的问题。每条已选会话默认展开，分别读取、折叠、分页和重试；取消选择会终止对应读取，延迟返回不能恢复已取消的内容。只读显示缓存支持一批 100 条会话，存放在本地临时目录中，并在插件关闭或重启时清理。

本地发布包已通过全新 Web profile 安装，38 项单元、23 项集成、13 项浏览器检查，以及 5 条原生会话重启后和卸载插件后的两轮续聊。浏览器覆盖四会话同时展示、独立分页、折叠、取消和失败后重读；归档拦截继续有效。桌面端本次仅确认已启用 0.2.1 界面，自动点击仍返回无可用窗口，尚未完成 0.2.2 桌面更新或原生保存弹窗验收。

## 0.2.1 验收

GitHub `v0.2.1` 已通过全新 Web profile 安装、构建文件一致性、12 项浏览器检查和两轮续聊。38 项单元与22 项集成检查通过。自动化验证保存位置选择先于任务创建、成功浮层消失、自动对话加载和旧响应隔离；文件选择器使用受控替身。桌面端系统保存对话框尚未实测。

## 0.2.0 验收

`v0.2.0` 的本地发布包与 GitHub 固定标签均已在官方未修改的 DSH 0.2.1-rc.5 的全新 profile 中完成安装验收。主端、前端和 worker 构建文件与提交内容逐字节一致。34 项单元、21 项集成、11 项浏览器检查通过，覆盖真正写入 DSH 的纯对话历史、批量导出与导入、记录删除、任务恢复和归档拦截；5 条会话分别通过重启及卸载插件后的续聊。

具体测试与本机 20 条有效来源的只读检查见 [验证记录](dsh-alink-verification.md)。

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
node scripts/release-smoke.mjs github:EchoBelle/dsh-alink#v0.2.2
```

需要本机 Google Chrome。验收使用合成来源和本地测试模型，不迁移日常会话，不发起真实模型请求。结果保存在 .local/releases/latest-smoke.json，日志位于 .local/verification。
