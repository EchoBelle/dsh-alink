# dsh-alink

将 **当前有效、未归档** 的 WorkBuddy、Codex、小浣熊和 Cursor 会话迁入 DeepSeek Harness，并在 DSH 中继续对话。

dsh-alink 是原生 TypeScript 插件，提供 DSH 内的“Alink”面板。它不启动独立应用或 Python 服务。导入新增独立会话，来源数据保持只读。

## 版本与安装

当前固定适配 **DSH 0.2.1-rc.5**、Node.js **24.14+（24 系列）**，验收平台为 macOS Apple Silicon。其他 DSH 版本需要完成兼容性验证后再放宽版本范围。

从 GitHub 安装（仓库包含预构建的 lib，不需要安装时编译）：

```sh
npm install -g @deepseek-ai/dsh@0.2.1-rc.5
dsh plugin --profile web add --workspace-root github:EchoBelle/dsh-alink#v0.1.2
dsh --profile web --dump-config
dsh web
```


首次创建 Web profile 时，可先运行 `dsh --profile web --dump-config`。安装绑定到所选 profile；建议固定版本标签或完整提交 SHA。测试使用独立 `DSH_HOME`。

已安装匹配版本 DSH 时可跳过第一行。普通安装直接使用 `dsh` 命令，无需安装 pnpm 或克隆源码；上述命令可在 PowerShell、CMD 和 macOS 终端执行。Windows 的来源扫描仍需单独验证，目前默认来源路径以 macOS 为基础。

## 使用

1. 在 DSH 侧栏打开“Alink”，选择来源应用，按项目展开并选择会话。
2. 选择已存在的目标项目目录及 DSH 配置，点击“生成迁移预览”。
3. 查看用户与助手的对话正文，确认后迁入。
4. 在迁移记录中打开原生会话、查看对话或下载原始备份。

**归档规则贯穿整个流程**：发现时排除已归档、已删除和状态不明的会话；捕获前后、提交时、附件处理后再次核实。预览后被归档的会话不能迁入。备份导入也必须关联到原应用中仍可核实为有效的会话，不能用旧备份绕过此规则。

“从备份导入”支持 ALink 0.1.0 ZIP/目录和旧 DSH v0 JSONL/Zstandard 文件。旧 DSH 需要可核实的原生归档状态。当前 DSH 的输出会话不作为自动扫描来源。

## 内容与边界

| 内容 | 处理 |
|---|---|
| 有效用户/助手正文 | 保持正文、角色、换行和顺序，转换为原生历史 |
| 工具调用与结果 | 转为明确标注的历史说明，不执行或注册来源工具 |
| 已收集文件和受支持图片 | 通过 DSH 附件服务迁入；原始字节保存在备份中 |
| 系统/开发者提示、推理和私有卡片 | 仅保存在原始备份，不变成 DSH 当前运行指令 |
| 隐藏或失效消息 | 仅保存在备份，不恢复为活动上下文 |
| 未解析的分支、压缩或外部历史 | 阻止可继续会话导入，报告具体缺口 |

Alink 的对话预览仅显示用户与助手的正文，隐藏工具日志、自动注入的规则/环境说明及生成的附件说明；原始记录与迁入所需上下文仍保留。

DSH 的轮次和流式展示是重建结构，不代表来源真实执行过程。迁移本身不调用模型；继续对话由 DSH 当前模型、工具和权限设置处理。

来源解析以旧版已验证的 WorkBuddy 5.5.4、Codex 26.903、Raccoon 1.0.23、Cursor 3.19 等存储形态为基础，并检查实际结构和归档状态。没有承诺所有未来版本兼容。扫描发生在 **DSH Host 所在电脑**，远程浏览器不会自动提供其本地来源库。

一次迁移一条会话；不合并已有会话，不提供双向同步或自动撤销。重复提交复用同一迁移记录。中断后只补写严格匹配的已知前缀；目标内容或项目归属已改变时保留现场并要求核对，不覆盖或删除。

## 数据与配置

默认数据目录为 `$DSH_HOME/storages/dsh-alink`，保存来源快照、原始记录、资源、迁移计划和操作凭据。来源数据库只读；关联资源只在来源根目录或显式允许的资源根内收集，不自动抓取远程 URL。

可在插件配置中设置 `dataDir`、`sourceRoots`、`resourceRoots`、`maxTextBytes` 和 `maxMessages`。`sourceRoots` 的键为 `workbuddy`、`codex`、`raccoon`、`cursor`、`dsh`；空字符串禁用该来源。

默认限制：单条 JSONL 16 MiB，归档/解压内容 2 GiB、ZIP 100000 条目，映射文本 32 MiB、活动消息 50000 条。超限不会静默截断目标历史；预览显示截断时仍保留完整迁入内容。图片另受 DSH 自身附件限制。

原始包仍采用 `alink.session` 0.1.0，产品更名不改写历史格式。旧桌面版代码已移除；仓库和安装包仅提供原生插件实现，用户数据不参与发布。

## 开发与验证

```sh
pnpm install
pnpm check:dsh
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
pnpm test:package
pnpm test:e2e
```

pnpm 只用于源码开发。`test:package` 构建并检查发布包；`test:e2e` 从新发布包自动创建隔离 DSH profile，完成迁入、归档拦截、重启续聊和卸载后续聊验证，需要本机 Google Chrome。详情见 [验证记录](docs/dsh-alink-verification.md)。测试不能指向日常使用的 DSH 数据库。

- [GitHub 安装与验收](docs/github-installation.md)
- [归档格式](docs/format-v0.1.md)
