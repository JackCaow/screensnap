# Project Overview

screensnap 是一个 Chrome 扩展（Manifest V3），用于截图、标注、GIF 录制和图片预览编辑。运行环境是浏览器扩展，包含 service worker（background）、content scripts（content）、popup UI 和 preview 编辑器（canvas-based）。

## Critical Risks

- **权限蔓延**：`manifest.json` 的 `permissions` / `host_permissions` 任何新增都必须高优先级审查；`<all_urls>` 已经是最大权限范围，不允许进一步扩大。
- **内容脚本注入风险**：content scripts 注入到任意页面，禁止使用 `innerHTML` / `document.write` / `eval` / `new Function`，所有 DOM 写入必须用 `textContent` 或经过转义。
- **Service worker 生命周期**：MV3 service worker 是临时的，随时可能被销毁；任何状态都必须落到 `chrome.storage`，不能依赖模块级变量。
- **消息通道身份校验**：`chrome.runtime.onMessage` / `onConnect` 必须校验 `sender.id === chrome.runtime.id`，禁止信任 `sender.url` 或 `sender.tab` 之外的字段。
- **事件监听器泄漏**：`window` / `document` 上的 `addEventListener` 必须有配对的 `removeEventListener`，特别是 preview 模块的拖拽、键盘、blur 事件——历史上已经出过状态卡住的 bug。
- **Canvas 资源释放**：preview 的 canvas 操作要注意 `ImageBitmap` / `OffscreenCanvas` / blob URL 的释放，避免内存泄漏。

## Review Priorities

1. 先看权限和注入安全
2. 再看 service worker / content script 生命周期与状态一致性
3. 然后看 canvas 操作和内存释放
4. 最后看命名、风格、注释

## Directory Rules

- `manifest.json`：任何字段变动都要重点审查，尤其是 `permissions`、`host_permissions`、`content_scripts.matches`、`web_accessible_resources`。
- `background/`：service worker 代码，禁止使用 `setTimeout` 做长时间调度（worker 会被销毁），需用 `chrome.alarms`。
- `content/`：注入到任意页面，DOM 操作必须最小化、不污染宿主页面全局命名空间。
- `preview/`：canvas + 拖拽 + 键盘事件密集区，重点审查事件监听器配对和状态机一致性。
- `_locales/`：i18n 文件，新增 key 时所有语言必须同步补全。

## Ignore or De-emphasize

- `dist/`、`*.zip`、`screensnap-v*.zip`：构建产物，跳过审查。
- `_locales/*/messages.json`：仅文案变更降权，但 key 缺失/类型不一致仍要指出。
- `docs/`、`*.md`：文档变更不需要 deep dive，只看明显错误。

## Team Conventions

- 不要吞异常：捕获后必须 `console.error` 或上报，禁止空 catch。
- 不要硬编码用户可见字符串：所有 UI 文本走 `chrome.i18n.getMessage`。
- 不要直接修改 DOM 全局：content script 创建的元素必须有项目专属前缀（如 `screensnap-`）。
- 任何 `chrome.storage` 写操作都要考虑配额和清理策略。
