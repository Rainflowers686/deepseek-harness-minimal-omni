# Minimal Omni

让 DeepSeek Harness 默认保持精简。任务需要浏览器、文档或代码导航时，
Minimal Omni 才为当前会话申请对应能力，完成后再释放。

[English](README.md) · [简体中文](README.zh-CN.md)

Minimal Omni 是独立的 Developer Preview，不替换官方 Web 应用，也不会改动
你的 provider、模型或凭据设置。

## 为什么使用它？

| | 工具较多的配置 | Minimal Omni |
| --- | --- | --- |
| 空闲时可见的工具 | 取决于配置，通常较多 | `pwsh`、`str_replace_editor`、`request_capability`、`release_capability` |
| 浏览器 | 可能一直存在 | 需要时才申请 |
| 文档工具 | 取决于配置 | 需要时才申请 |
| 规划或审查提示 | 取决于配置 | 本包不会额外加入 |
| 卸载 | 取决于配置 | 一条 DSH 插件命令 |

模型仍然使用官方 Minimal brain。额外工作由运行时负责，不会加入 planner 或
reviewer loop。

## 安装

在平时使用的 DSH 环境中执行一次：

```powershell
dsh plugin --profile web add github:Rainflowers686/deepseek-harness-minimal-omni#v0.2.0-preview.2
```

这条命令只向现有 `web` profile 增加一个 bundle，不会修改默认 preset、
provider、模型、凭据、代理或权限。

## 使用

正常启动 Web profile：

```powershell
dsh --profile web
```

新建会话，打开 **Agent preset**，选择 **Minimal Omni**。Standard 和其它
已经安装的 preset 仍然可用。

一般编码任务开始时工具很少。需要当前网页、PDF 或仓库导航时，会话可以申请
Browser、Documents 或 Code/LSP，完成后再释放。

## 卸载

```powershell
dsh plugin --profile web remove @rain/minimal-omni
```

卸载只移除 Minimal Omni bundle，不会删除会话、凭据或其它 preset。需要时再
执行上面的固定版本安装命令即可恢复。

## 能力范围

请查看[能力分层矩阵](docs/CAPABILITY_MATRIX_CN.md)。本预览已支持并经过验证的
范围包括 Minimal brain、按需 Code/LSP、Browser、Web fetch、PDF/DOCX/ZIP 提取、
Jobs、native Goal、手动 `/compact`、session reload 和完整编码闭环。

XLSX/PPTX 的 model-facing 工作流、成功 compaction 后的 Goal 连续性、automatic
compaction 调参和可选媒体提取属于 Experimental。Vision 取决于所选 route 是否
支持图像输入；Web Search 和已授权 GitHub 操作需要另外的 provider/授权。桌面
自动化、ASR、广义音视频理解和跨 Agent handoff 暂不在范围内。

## 兼容性

已测试运行时为 `dsh-v0.1.2-rc.1`，commit 为
`a66e4702047846cdaa10c66c9d3df3951f5ea70d`。首个正式支持平台是 Windows；尝试
其它 DSH 构建前请先阅读[兼容性说明](docs/COMPATIBILITY.md)。

## 安全提示

- capability 工具使用当前会话工作区，并限制输出大小。
- 浏览器 profile、下载、截图和 Jobs 由运行时创建和清理。
- 已知不支持图像输入的 Vision route 会在使用图像工具前返回不可用。
- acceptance/CI 模式有更严格的请求和 DSH_HOME 检查；普通用户不需要 ledger
  或人为的请求预算。
- Issue 中不要粘贴 API key、cookie 或含私人内容的完整 session log。

更多信息见 [SECURITY.md](docs/SECURITY.md) 和
[TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)。

## 开发

维护者请阅读 [DEVELOPMENT.md](docs/DEVELOPMENT.md)。静态检查和打包检查不需要
provider key。

## 许可证

MIT。见 [LICENSE](LICENSE)、[NOTICE.md](NOTICE.md)、
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) 和
[PROVENANCE.md](PROVENANCE.md)。
