# ScreenSnap

一款简洁高效的 Chrome 截图扩展，支持区域截图、可视区域截图和全页长截图，内置标注编辑器。

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-green?logo=googlechrome&logoColor=white)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)
![License](https://img.shields.io/badge/License-MIT-yellow)

## 功能特性

### 截图模式

| 模式 | 快捷键 | 说明 |
|------|--------|------|
| 区域截图 | `Alt+Shift+S` | 拖拽选区，精确截取任意区域 |
| 可视区域 | `Alt+Shift+A` | 一键截取当前浏览器可视区域 |
| 长截屏 | `Alt+Shift+F` | 自动滚动拼接，截取完整页面 |

### 标注编辑器

截图后自动打开标注编辑器，支持：

- **形状工具** — 矩形、椭圆、箭头、直线
- **画笔工具** — 自由绘制、荧光笔
- **文字标注** — 添加文字说明
- **序号标注** — 添加编号标记
- **隐私保护** — 马赛克、模糊遮挡敏感信息
- **颜色/线宽** — 12 种预设颜色 + 自定义色 + 4 种线宽
- **撤销/重做** — 完整操作历史
- **缩放控制** — 滚轮缩放、适应宽度、适应窗口
- **导出** — 复制到剪贴板 / 下载 PNG

### 长截屏技术亮点

- 智能重叠滚动拼接，自动消除 sticky/fixed 头部重复（如 Google 搜索栏）
- 无限滚动页面检测与自动捕获
- Service Worker 保活机制，防止长时间截取中断
- API 限频自动重试

## 安装

### 从源码安装（开发模式）

1. 克隆仓库：
   ```bash
   git clone https://github.com/JackCaow/screensnap.git
   ```

2. 打开 Chrome，进入 `chrome://extensions/`

3. 开启右上角「开发者模式」

4. 点击「加载已解压的扩展程序」，选择项目目录

### 从 Chrome Web Store 安装

> 即将上架，敬请期待。

## 项目结构

```
screensnap/
├── manifest.json          # 扩展配置（Manifest V3）
├── background/
│   └── background.js      # Service Worker：截图逻辑、图片拼接
├── content/
│   ├── content.js         # 内容脚本：页面滚动、固定元素处理
│   └── selector.js        # 区域选择器：拖拽选区 UI
├── popup/
│   ├── popup.html         # 弹窗 UI
│   ├── popup.js           # 弹窗逻辑
│   └── popup.css          # 弹窗样式
├── preview/
│   ├── preview.html       # 标注编辑器 UI
│   ├── preview.js         # 标注编辑器逻辑（Canvas 绘制）
│   └── preview.css        # 标注编辑器样式
├── assets/icons/          # 扩展图标（16/48/128px）
└── script/
    └── generate-icons.js  # 图标生成脚本
```

## 开发

项目为纯前端 Chrome 扩展，无需构建工具，无外部依赖。

```bash
# 生成图标
node script/generate-icons.js
```

修改代码后在 `chrome://extensions/` 点击刷新按钮即可生效。

## 快捷键自定义

Chrome 浏览器中进入 `chrome://extensions/shortcuts`，可自定义各截图模式的快捷键。

## 浏览器兼容

- Chrome 88+（Manifest V3）
- Edge 88+（Chromium 内核）

## 许可证

[MIT](LICENSE)
