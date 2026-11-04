# DSH 界面安装器修复

Alink 的安装包无需构建脚本。当前阻碍界面安装的是 DSH 0.2.1-rc.5 的安装器：它在自身管理的 profile 工作区中执行 `pnpm add <spec>`，没有指定 `--workspace-root`，因此包管理器在读取 Alink 安装包之前就返回 `ERR_PNPM_ADDING_TO_ROOT`。官方 0.2.2-alpha.3 中的安装调用也缺少该参数。

[dsh-plugin-manager-workspace-root.patch](dsh-plugin-manager-workspace-root.patch) 针对 DSH 官方源码的安装调用补上该参数。它只明确当前安装目标，不关闭用户机器上的全局检查，不运行插件安装钩子，也不修改 profile 设置。此补丁需要由 DSH 安装器采用，Alink 自身无法修复尚未加载前的安装步骤。

验证使用真实 DSH 原生“添加插件”对话框。原版 DSH 在全新 profile 上复现 `ERR_PNPM_ADDING_TO_ROOT`；测试可在单独环境加载仅增加该参数的安装器副本。副本不替换本机正式安装。

```sh
node scripts/release-smoke.mjs .local/releases/dsh-alink-0.1.1.tgz --ui
```

上述命令直接验证所选 DSH 是否支持界面安装，不自动忽略失败。`DSH_ALINK_TEST_CLI` 可指定要验证的 DSH 启动文件；`DSH_ALINK_TEST_MANAGER` 仅供测试时指定修复后的安装器模块，结果会明确记录 `installerPatched: true`。这种结果不代表原版 DSH 已修复。
