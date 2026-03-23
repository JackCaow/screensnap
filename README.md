# ScreenSnap

[中文](#中文) | [English](#english) | [繁體中文](#繁體中文) | [日本語](#日本語) | [한국어](#한국어) | [Español](#español) | [Português](#português)

---

<a id="中文"></a>

一款简洁高效的 Chrome 截图扩展，支持区域截图、可视区域截图、全页长截图和 GIF 录制，内置标注编辑器。

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-green?logo=googlechrome&logoColor=white)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)
![License](https://img.shields.io/badge/License-MIT-yellow)

## 截图预览

<table>
  <tr>
    <td align="center" width="300">
      <img src="docs/popup.png" width="280" alt="弹窗菜单" />
      <br /><b>弹窗菜单</b>
    </td>
    <td align="center">
      <img src="docs/editor.png" alt="标注编辑器 + 长截屏" />
      <br /><b>标注编辑器 + 长截屏</b>
    </td>
  </tr>
</table>

## 功能特性

### 截图模式

| 模式 | 快捷键 | 说明 |
|------|--------|------|
| 区域截图 | `Alt+Shift+S` | 拖拽选区，精确截取任意区域 |
| 可视区域 | `Alt+Shift+A` | 一键截取当前浏览器可视区域 |
| 长截屏 | — | 自动滚动拼接，截取完整页面 |
| GIF 录制 | `Alt+Shift+G` | 选区录制动画 GIF |

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

### GIF 录制

- 拖拽选区录制，最长 15 秒
- Median-cut 色彩量化 + Floyd-Steinberg 抖动
- 每帧独立调色板（Local Color Table），色彩精准
- 原生分辨率，无缩放模糊

### 长截屏技术亮点

- 智能重叠滚动拼接，自动消除 sticky/fixed 头部重复
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

## 快捷键自定义

Chrome 浏览器中进入 `chrome://extensions/shortcuts`，可自定义各截图模式的快捷键。

## 浏览器兼容

- Chrome 88+（Manifest V3）
- Edge 88+（Chromium 内核）

## 许可证

[MIT](LICENSE)

---

<a id="english"></a>

# ScreenSnap

A clean, efficient Chrome screenshot extension with region capture, visible area capture, full-page scrolling capture, and GIF recording — with a built-in annotation editor.

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-green?logo=googlechrome&logoColor=white)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)
![License](https://img.shields.io/badge/License-MIT-yellow)

## Screenshots

<table>
  <tr>
    <td align="center" width="300">
      <img src="docs/popup.png" width="280" alt="Popup Menu" />
      <br /><b>Popup Menu</b>
    </td>
    <td align="center">
      <img src="docs/editor.png" alt="Annotation Editor + Full Page" />
      <br /><b>Annotation Editor + Full Page</b>
    </td>
  </tr>
</table>

## Features

### Capture Modes

| Mode | Shortcut | Description |
|------|----------|-------------|
| Region | `Alt+Shift+S` | Drag to select and capture any area |
| Visible Area | `Alt+Shift+A` | Capture the current browser viewport |
| Full Page | — | Auto-scroll and stitch the entire page |
| GIF Recording | `Alt+Shift+G` | Record a selected region as animated GIF |

### Annotation Editor

A full-featured editor opens automatically after capture:

- **Shapes** — Rectangle, ellipse, arrow, line
- **Drawing** — Freehand pen, highlighter
- **Text** — Add text annotations
- **Numbering** — Add numbered markers
- **Privacy** — Mosaic and blur to redact sensitive info
- **Color / Stroke** — 12 preset colors + custom picker + 4 stroke widths
- **Undo / Redo** — Full action history
- **Zoom** — Scroll zoom, fit width, fit view
- **Export** — Copy to clipboard / download PNG

### GIF Recording

- Drag to select recording region, up to 15 seconds
- Median-cut color quantization + Floyd-Steinberg dithering
- Per-frame Local Color Table for accurate colors
- Native resolution, no downscaling blur

### Full Page Capture

- Smart overlap-based stitching that removes sticky/fixed header duplication
- Infinite scroll detection and auto-capture
- Service Worker keep-alive to prevent interruption during long captures
- Automatic rate-limit retry

## Installation

### From Source (Developer Mode)

1. Clone the repository:
   ```bash
   git clone https://github.com/JackCaow/screensnap.git
   ```

2. Open Chrome and go to `chrome://extensions/`

3. Enable **Developer mode** (top right)

4. Click **Load unpacked** and select the project directory

### From Chrome Web Store

> Coming soon.

## Customize Shortcuts

Go to `chrome://extensions/shortcuts` in Chrome to customize keyboard shortcuts.

## Browser Compatibility

- Chrome 88+ (Manifest V3)
- Edge 88+ (Chromium-based)

## License

[MIT](LICENSE)

---

<a id="繁體中文"></a>

# ScreenSnap

一款簡潔高效的 Chrome 截圖擴充功能，支援區域截圖、可視區域截圖、整頁長截圖和 GIF 錄製，內建標註編輯器。

## 功能特性

| 模式 | 快捷鍵 | 說明 |
|------|--------|------|
| 區域截圖 | `Alt+Shift+S` | 拖曳選區，精確截取任意區域 |
| 可視區域 | `Alt+Shift+A` | 一鍵截取目前瀏覽器可視區域 |
| 長截圖 | — | 自動捲動拼接，截取完整頁面 |
| GIF 錄製 | `Alt+Shift+G` | 選區錄製動畫 GIF |

### 標註編輯器

- **形狀工具** — 矩形、橢圓、箭頭、直線
- **畫筆工具** — 自由繪製、螢光筆
- **文字標註** — 新增文字說明
- **序號標註** — 新增編號標記
- **隱私保護** — 馬賽克、模糊遮擋敏感資訊
- **顏色/線寬** — 12 種預設顏色 + 自訂色 + 4 種線寬
- **復原/重做** — 完整操作歷史
- **縮放控制** — 滾輪縮放、適應寬度、適應視窗
- **匯出** — 複製到剪貼簿 / 下載 PNG

## 安裝

1. 複製儲存庫：`git clone https://github.com/JackCaow/screensnap.git`
2. 開啟 Chrome，進入 `chrome://extensions/`
3. 開啟右上角「開發人員模式」
4. 點擊「載入未封裝項目」，選擇專案目錄

## 授權條款

[MIT](LICENSE)

---

<a id="日本語"></a>

# ScreenSnap

範囲キャプチャ、表示領域キャプチャ、フルページスクロールキャプチャ、GIF録画機能を備えた、シンプルで効率的な Chrome スクリーンショット拡張機能。注釈エディタ内蔵。

## 機能

| モード | ショートカット | 説明 |
|--------|---------------|------|
| 範囲キャプチャ | `Alt+Shift+S` | ドラッグで任意の範囲をキャプチャ |
| 表示領域 | `Alt+Shift+A` | 現在のブラウザ表示領域をキャプチャ |
| ページ全体 | — | 自動スクロールでページ全体をキャプチャ |
| GIF録画 | `Alt+Shift+G` | 選択範囲をアニメーション GIF として録画 |

### 注釈エディタ

- **図形ツール** — 矩形、楕円、矢印、直線
- **描画ツール** — フリーハンド、蛍光ペン
- **テキスト注釈** — テキストを追加
- **番号マーカー** — 番号付きマーカーを追加
- **プライバシー保護** — モザイク・ぼかしで機密情報を隠す
- **色 / 線幅** — 12色プリセット + カスタムカラー + 4段階の線幅
- **元に戻す / やり直す** — 完全な操作履歴
- **ズーム** — スクロールズーム、幅に合わせる、ウィンドウに合わせる
- **エクスポート** — クリップボードにコピー / PNG ダウンロード

## インストール

1. リポジトリをクローン：`git clone https://github.com/JackCaow/screensnap.git`
2. Chrome で `chrome://extensions/` を開く
3. 右上の「デベロッパーモード」を有効にする
4. 「パッケージ化されていない拡張機能を読み込む」をクリックし、プロジェクトディレクトリを選択

## ライセンス

[MIT](LICENSE)

---

<a id="한국어"></a>

# ScreenSnap

영역 캡처, 보이는 영역 캡처, 전체 페이지 스크롤 캡처, GIF 녹화 기능을 갖춘 간결하고 효율적인 Chrome 스크린샷 확장 프로그램. 주석 편집기 내장.

## 기능

| 모드 | 단축키 | 설명 |
|------|--------|------|
| 영역 캡처 | `Alt+Shift+S` | 드래그하여 원하는 영역 캡처 |
| 보이는 영역 | `Alt+Shift+A` | 현재 브라우저 뷰포트 캡처 |
| 전체 페이지 | — | 자동 스크롤로 전체 페이지 캡처 |
| GIF 녹화 | `Alt+Shift+G` | 선택 영역을 애니메이션 GIF로 녹화 |

### 주석 편집기

- **도형 도구** — 사각형, 타원, 화살표, 직선
- **그리기 도구** — 자유 그리기, 형광펜
- **텍스트 주석** — 텍스트 추가
- **번호 마커** — 번호 표시 추가
- **개인정보 보호** — 모자이크, 흐림으로 민감한 정보 가리기
- **색상 / 선 굵기** — 12가지 프리셋 색상 + 사용자 정의 + 4단계 선 굵기
- **실행 취소 / 다시 실행** — 전체 작업 기록
- **확대/축소** — 스크롤 줌, 너비 맞춤, 창 맞춤
- **내보내기** — 클립보드에 복사 / PNG 다운로드

## 설치

1. 저장소 클론: `git clone https://github.com/JackCaow/screensnap.git`
2. Chrome에서 `chrome://extensions/` 열기
3. 오른쪽 상단의 **개발자 모드** 활성화
4. **압축해제된 확장 프로그램을 로드합니다** 클릭 후 프로젝트 디렉토리 선택

## 라이선스

[MIT](LICENSE)

---

<a id="español"></a>

# ScreenSnap

Extensión de Chrome para capturas de pantalla: captura de región, área visible, página completa con desplazamiento y grabación GIF — con editor de anotaciones integrado.

## Funciones

| Modo | Atajo | Descripción |
|------|-------|-------------|
| Región | `Alt+Shift+S` | Arrastra para seleccionar y capturar cualquier área |
| Área visible | `Alt+Shift+A` | Captura la ventana visible del navegador |
| Página completa | — | Desplazamiento automático para capturar toda la página |
| Grabación GIF | `Alt+Shift+G` | Graba una región seleccionada como GIF animado |

### Editor de anotaciones

- **Formas** — Rectángulo, elipse, flecha, línea
- **Dibujo** — Lápiz libre, resaltador
- **Texto** — Agregar anotaciones de texto
- **Numeración** — Agregar marcadores numerados
- **Privacidad** — Mosaico y difuminado para ocultar información sensible
- **Color / Grosor** — 12 colores predefinidos + personalizado + 4 grosores de línea
- **Deshacer / Rehacer** — Historial completo de acciones
- **Zoom** — Zoom con scroll, ajustar al ancho, ajustar a la ventana
- **Exportar** — Copiar al portapapeles / descargar PNG

## Instalación

1. Clonar el repositorio: `git clone https://github.com/JackCaow/screensnap.git`
2. Abrir Chrome y navegar a `chrome://extensions/`
3. Activar el **Modo de desarrollador** (esquina superior derecha)
4. Hacer clic en **Cargar descomprimida** y seleccionar el directorio del proyecto

## Licencia

[MIT](LICENSE)

---

<a id="português"></a>

# ScreenSnap

Extensão Chrome para capturas de tela: captura de região, área visível, página inteira com rolagem e gravação de GIF — com editor de anotações integrado.

## Funcionalidades

| Modo | Atalho | Descrição |
|------|--------|-----------|
| Região | `Alt+Shift+S` | Arraste para selecionar e capturar qualquer área |
| Área visível | `Alt+Shift+A` | Captura a janela visível do navegador |
| Página inteira | — | Rolagem automática para capturar toda a página |
| Gravação GIF | `Alt+Shift+G` | Grava uma região selecionada como GIF animado |

### Editor de anotações

- **Formas** — Retângulo, elipse, seta, linha
- **Desenho** — Caneta livre, marca-texto
- **Texto** — Adicionar anotações de texto
- **Numeração** — Adicionar marcadores numerados
- **Privacidade** — Mosaico e desfoque para ocultar informações sensíveis
- **Cor / Espessura** — 12 cores predefinidas + personalizada + 4 espessuras de linha
- **Desfazer / Refazer** — Histórico completo de ações
- **Zoom** — Zoom com scroll, ajustar à largura, ajustar à janela
- **Exportar** — Copiar para área de transferência / baixar PNG

## Instalação

1. Clonar o repositório: `git clone https://github.com/JackCaow/screensnap.git`
2. Abrir Chrome e navegar para `chrome://extensions/`
3. Ativar o **Modo de desenvolvedor** (canto superior direito)
4. Clicar em **Carregar sem compactação** e selecionar o diretório do projeto

## Licença

[MIT](LICENSE)
