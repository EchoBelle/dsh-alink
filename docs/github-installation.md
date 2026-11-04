# GitHub 安装

仓库：EchoBelle/dsh-alink。插件需要 DSH 0.2.1-rc.5 和 Node.js 24.14+（24 系列）。

```sh
dsh --profile web --dump-config
dsh plugin --profile web add --workspace-root github:EchoBelle/dsh-alink#v0.1.0
dsh web
```

仓库跟踪源码和预构建 lib。GitHub 安装不执行 prepare/prepack 构建；开发时修改源码后，需要重新运行 build 并将对应 lib 一并提交。

GitHub 安装验收结果将在完成后记录于此。
