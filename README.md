# Everything Quick Launcher

一个面向 Windows 的键盘优先快速启动器。它把本机 Everything 的搜索能力包装成轻量浮窗：双击 `Ctrl` 呼出，输入关键词，直接打开文件、定位目录或复制路径。

## 功能概览

```mermaid
flowchart LR
  A["双击 Ctrl"] --> B["显示搜索浮窗"]
  B --> C["输入关键词或过滤器"]
  C --> D["应用候选搜索"]
  C --> E["文件和文件夹搜索"]
  D --> F["解析 Everything 元数据"]
  E --> F
  F --> G["按常用结果和搜索结果分组"]
  G --> H{"用户操作"}
  H --> I["Enter 打开"]
  H --> J["Alt+Enter 定位"]
  H --> K["Ctrl+C 复制路径"]
```

- 使用 `EVERYTHING_PATH` 目录下的 `es.exe` 获取本机文件、文件夹和应用结果。
- 默认查询会先搜索 `exe`、`lnk` 应用候选，再搜索更广泛的文件和文件夹结果。
- 支持 `folder:`、`file:`、`doc:`、`pic:`、`video:`、`audio:` 类型过滤。
- 支持 `app:`、`recent:`、`path:`、`parent:` 等模式化查询。
- 支持 `!关键词` 排除结果，以及 Everything 原生 OR 语法，例如 `<qq|wechat>`。
- 支持路径约束，例如 `desktop\毕业` 会把路径和关键词拆开搜索。
- 支持中文名称的拼音和首字母排序增强，例如 `weixin`、`wx` 可命中中文应用名。
- 记录成功打开过的路径，让常用结果在后续搜索中更靠前。
- 读取 Everything 的运行次数和最近运行时间，让常用结果与搜索结果排序更贴近日常使用习惯。
- 默认只展示两组：`常用结果` 最多 5 条，`搜索结果` 最多 20 条。
- Everything IPC 未运行时会尝试启动 `EVERYTHING_PATH` 目录下的 `Everything.exe` 后重试。

## 使用方式

启动应用后，它默认隐藏在后台。

| 操作 | 说明 |
| --- | --- |
| 双击 `Ctrl` | 呼出并聚焦搜索浮窗 |
| `Esc` | 隐藏浮窗 |
| `↑` / `↓` | 切换选中结果 |
| `Enter` | 打开选中结果 |
| `Alt+Enter` | 在资源管理器中定位选中结果 |
| `Ctrl+C` | 复制选中结果路径 |
| `Alt+1` 到 `Alt+8` | 直接打开当前可见的第 1 到第 8 个结果 |
| `Ctrl+9` | 展示更多结果 |

## 查询语法

| 示例 | 含义 |
| --- | --- |
| `qq` | 搜索名称或路径中包含 `qq` 的结果 |
| `folder: project` | 只搜索文件夹 |
| `file: report` | 只搜索文件 |
| `doc: 毕业` | 搜索文档类文件，如 `docx`、`pdf`、`md`、`xlsx`、`pptx` |
| `pic: logo` | 搜索图片类文件 |
| `video: demo` | 搜索视频类文件 |
| `audio: music` | 搜索音频类文件 |
| `app: qq` | 只搜索应用候选，如 `exe` 和 `lnk` |
| `recent: code` | 按 Everything 最近运行时间优先搜索 |
| `path:D:\Downloads qq` | 在指定路径范围内搜索关键词 |
| `parent:D:\Downloads qq` | 只搜索指定父目录下的结果 |
| `qq !backup` | 搜索 `qq`，排除包含 `backup` 的结果 |
| `<qq|wechat>` | 使用 Everything OR 语法搜索多个候选词 |
| `D:\Work\ report` | 在路径约束下搜索关键词 |

## 运行环境

- Windows
- Node.js 和 npm
- Everything 已安装，并且 `Everything.exe` 与 `es.exe` 位于同一目录
- 已设置 `EVERYTHING_PATH` 环境变量，值为 `Everything.exe` 和 `es.exe` 所在目录

示例：

```powershell
[Environment]::SetEnvironmentVariable("EVERYTHING_PATH", "C:\Program Files\Everything", "User")
```

设置后需要重启终端或重新启动应用，让新环境变量生效。`EVERYTHING_PATH` 必须是目录路径，不要写成 `C:\Program Files\Everything\Everything.exe`。

## 开发

安装依赖：

```powershell
npm install
```

运行测试：

```powershell
npm test
```

构建渲染进程和主进程：

```powershell
npm run build
```

构建后启动 Electron：

```powershell
npm start
```

打包 Windows portable 版本：

```powershell
npm run dist
```

## 项目结构

```mermaid
graph TD
  A["Electron 主进程"] --> B["窗口与双 Ctrl 热键"]
  A --> C["IPC 注册"]
  C --> D["Everything 搜索适配器"]
  C --> E["文件动作"]
  D --> F["查询解析"]
  D --> G["结果排序"]
  D --> H["使用历史"]
  D --> I["Everything 运行元数据"]
  D --> N["EVERYTHING_PATH\\es.exe"]
  J["React 渲染进程"] --> K["搜索输入"]
  J --> L["常用结果和搜索结果列表"]
  J --> M["键盘操作"]
  J --> C
```

| 路径 | 作用 |
| --- | --- |
| `src/main/main.ts` | 创建无边框浮窗、注册全局键盘钩子、控制窗口显示和聚焦 |
| `src/main/ipc.ts` | 暴露搜索、打开、定位、复制、隐藏窗口等 IPC 能力 |
| `src/main/everythingSearch.ts` | 调用 Everything CLI，解析输出，处理 IPC 未运行时的重试 |
| `src/main/searchQuery.ts` | 解析查询过滤器、路径约束和关键词，生成 Everything 参数 |
| `src/main/searchRanking.ts` | 根据文件名、路径、类型、拼音、使用历史和 Everything 运行元数据计算排序 |
| `src/main/usageHistory.ts` | 读写打开历史，用于排序加权 |
| `src/renderer/App.tsx` | 搜索浮窗 UI、结果列表和快捷键交互 |
| `src/preload.cts` | 通过 `contextBridge` 暴露安全的渲染进程 API |
| `tests/` | Vitest 测试 |

## 搜索链路

```mermaid
sequenceDiagram
  participant U as 用户
  participant R as React 浮窗
  participant I as IPC
  participant S as 搜索适配器
  participant E as Everything CLI
  participant H as 使用历史

  U->>R: 输入查询
  R->>I: search(query)
  I->>S: searchEverything(query)
  S->>S: 解析模式、过滤器、路径约束和排除词
  S->>E: 执行应用候选搜索
  S->>E: 执行文件/文件夹搜索
  E-->>S: 返回 JSON、attributes、size、date-run 等结果
  S->>H: 读取历史
  S->>S: 过滤噪音候选并分组排序
  S-->>I: SearchResponse
  I-->>R: 搜索结果
  R-->>U: 按常用结果和搜索结果展示
```

## 测试重点

- 双击 `Ctrl` 的检测和窗口聚焦行为。
- Everything 输出解析、GB18030 解码、JSON attributes 类型判断和运行元数据读取。
- 查询过滤器、路径约束、父目录约束、排除词和扩展名过滤参数。
- 默认应用候选搜索、应用专搜、最近运行搜索和文件模式搜索。
- 拼音候选召回、拼音排序、常用结果/搜索结果分组排序。
- 打开成功后的使用历史记录。
- 分组标题渲染、`Alt+数字` 快速打开和 `Ctrl+9` 展示更多。
- Vite、Electron preload、窗口行为等配置。
