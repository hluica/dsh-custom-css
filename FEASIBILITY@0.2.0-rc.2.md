# DSH 用户 CSS 插件 —— 可行性与核心进路报告

- 目标插件：`@local/dsh-custom-css`，目录 `local-plugins/dsh-custom-css/`
- 目标：把用户自定义 CSS 片段注入 DeepSeek Harness 界面，实现外观自定义
- 报告日期：2026-10-10
- 结论：**可行，且存在一条明显优于其他方案的进路（双层注入）**

> **后续更新（实现阶段）**：本报告的「双层注入」是探究阶段的最优方案。经需求澄清后，实际实现**只采用客户端单层**：`document.head.appendChild`，位置落在 `<head>` 真正的末尾，因而同特异性下可覆盖内置样式。核心原因见 §5.6：注入系统**无法**把样式放在 `<head>` 末尾（`head` 行的语义是「`<head>` 开标签紧后面」），而客户端追加恰好补上这一位置。第 1 层（Host 关键层）经确认不需要，已不实现。**§5.1–5.5 保留为探究记录，§5.6 记录最终实现。**

---

## 1. 结论摘要

| 问题                 | 结论                                                                                                                                                                                                                         |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UI 如何显示？        | Web 单页应用。HTML 外壳由 Host 的 `webserver` 在每次请求时**动态渲染**；界面本体由 React 客户端插件（槽位系统）在浏览器内构建                                                                                                |
| 是否预留自定义接口？ | **预留了三处**，且都属公开契约：① Host 的 `webserver/index-inject` 事件（可注入 `<style>` 到 `<head>` 首部）；② 客户端 `<style>` 标签注入（模块加载器会自动接管并随插件卸载清理）；③ `ctx.theme.overrideTokens()` 主题令牌层 |
| 何时注入最佳？       | **分两层**：关键抑制层随 HTML 首包注入（避免首屏闪烁），主体层由客户端插件在 `apply()` 中追加到 `document.head` 末尾（取得样式优先级）                                                                                       |
| 以何方式注入最佳？   | 客户端 `document.head.appendChild(<style>)` 为主 → **源序压过所有内置样式表**，用户 CSS 无需堆叠特异性即可生效                                                                                                               |
| 关键风险             | 仅用 Host 注入会**被内置样式表按源序覆盖**，导致"看起来没生效"。这是本方案最需要避开的陷阱                                                                                                                                   |

---

## 2. 探究方法与证据来源

本次探究全部基于运行时实测与本机发行包源码，未依赖猜测：

1. **运行时自省**：`cordis_inspect_list` / `cordis_inspect_query` 查询 Host 与 Client 两端的 Service、Event、Slot、Theme、Builtin 目录。
2. **发行包源码**：直接读取 `/Applications/DeepSeek Harness.app/Contents/Resources/app.asar`（未打包的 `dsh/` 树），定位 `index-inject` 渲染器、客户端模块加载器、样式认领逻辑。
3. **既有同类插件**：`local-plugins/dsh-font-settings`（已在用，已验证可用）与 `~/.dsh/profiles/desktop/node_modules/dsh-whale-widget`（第三方 npm 插件）。
4. **本机 profile 配置**：`~/.dsh/profiles/desktop/` 下的 `package.json`、`cordis.patch.yml`、`pnpm-workspace.yaml`。

---

## 3. DSH UI 的显示方式

### 3.1 渲染链路

```
Host 进程 (Node/Electron)
  └─ @deepseek-ai/dsh-host-webserver
       ├─ 每次请求 / 时：collectIndexInjections() 发出 webserver/index-inject 事件
       │    → 插件把「注入行」push 进可变表 table[]
       ├─ renderIndexInjections(html, rows)
       │    → kind:'style' 的行固定渲染为 <style>…</style>
       │    → head 行插到「<head> 开标签之后」，body 行插到「<body> 开标签之后」
       └─ 再跑 tapIndex 原始字符串变换（遗留通道）
  ↓ HTTP
浏览器
  └─ window.__DSH_BOOT__ + __ModuleLoader__ 引导客户端插件图
       └─ 各客户端插件 apply(ctx) 用 React 挂载槽位（slots）
```

两个关键事实（源码确认）：

- `renderIndexInjections` 对 `kind:'style'` **强制 `placement: 'head'`**，并且是插在 `<head>` 开标签**紧后面**——即**位于内置样式表与入口脚本之前**。
- 注入表**每次渲染都是全新的**（`collectIndexInjections` 注释原文：*Fresh per call, so subscribers read live state (module graph, theme preference) at emit time*），监听器在发出时读取**当前**值。因此配置变更后下一次页面加载会自动带上新 CSS。

### 3.2 样式表层级

内置样式表（base token sheet）定义主题令牌，例如 `--dsw-font-family`、`--ds-font-family-code`、`--dsw-alias-bg-base`、`--dsw-alias-label-primary`、`--dsw-specific-sidebar-fill` 等（`Theme.listTokens` 实测返回 15 个令牌，均要求 light/dark 成对）。

**决定性结论**：由于 Host 注入的 `<style>` 落在 `<head>` 首部，它**先于**内置样式表被解析。CSS 层叠中，同特异性下**后出现的规则获胜**，所以：

> 仅仅把用户 CSS 从 Host 注入 `<head>` 首部，任何与内置样式同特异性的用户规则都会**被内置样式覆盖**。
> 这正是 `dsh-font-settings` 必须使用 `:root:root{…}`（特异性 0,2,0）这种"加倍特异性"技巧的根本原因——它的注释明确写了这一点。

这就是**为什么客户端注入是必需的，而不是可选的**。

---

## 4. 预留的自定义接口（可行性核心）

### 4.1 接口 A：Host `webserver/index-inject`（首屏关键层）

```ts
ctx.on('webserver/index-inject', (table: IndexInjection[]) => {
  table.push({ kind: 'style', text: css })
}, { prepend: true })
```

- 行类型：`{kind:'style', text}`、`{kind:'global', name, value}`、`{kind:'script'|'script-src', placement, …}`、`{kind:'html', placement, html}`。
- 触发时机：**每次索引渲染 / 每个 worker 启动载荷请求**。
- 可行性：✅ 已验证（`dsh-font-settings` 正在使用）。
- 适用：需要在**首帧之前**生效、消除闪烁的少量 CSS（如主题底色、隐藏元素、根令牌覆盖）。
- 局限：⚠️ 源序劣势（见 3.2）；文本量大会增大 HTML 首包。

### 4.2 接口 B：客户端 `<style>` 注入（主体层，推荐主力）

`dsh-client-modules`（模块加载器）的行为（源码确认）：

- 工厂函数 `factory(require)` 在**首次物化**时执行；注释原文：*every module-body side effect (CSS injection included) lives in the factory closure and runs at materialization*。
- 物化后会调用 `claimStyles(id)`：
  - 给文档中**尚无 `data-plugin` 属性**的 `<style>` 打上 `data-plugin = <插件包名>`；
  - 已带 `data-plugin`（如预设发射的 `data-plugin-css`）则按原样登记。
- 插件卸载 / HMR 重建时调用 `removeOwnedStyles(id)`，移除 `style[data-plugin=<id>]`。

**结论**：客户端插件在 `apply()`（或工厂体内）执行 `document.head.appendChild(styleEl)` 即可：

- ✅ 样式位于**所有内置样式表之后** → 源序获胜，用户 CSS 可直接写 `.dsw-xxx{…}` 而无需特异性技巧；
- ✅ 卸载 / 热重载时**自动清理**，不留残留；
- ✅ 被 `dsh-client-hmr` 纳入热重载链路，改代码后浏览器自动热替换。

**最佳实践**：自行预设 `tag.dataset.plugin = '<包名>'`（`dsh-font-settings` 即如此），避免依赖加载器对"未标记 style 的全局认领"。全局认领是同步窗口内的兜底机制，主动标注更精确、更安全。

> 注意区分两条客户端插件通道：
> - **模块加载器通道**（本插件应采用）：`package.json` 声明 `dsh.client` + `exports["./client"]`，产物形如 `window.__ModuleLoader__.load({ id, factory(require){…} })`。**没有** `styles` 全局符号，直接用 DOM API。
> - **动态客户端通道**（`cordis-client-runner` 闭包，Agent 运行时生成）：提供 `styles.insert(css)` 等内建符号。此通道**不适用于**本插件——它面向运行时动态定义，需要动态 Agent Guard 的 key 绑定。

### 4.3 接口 C：`ctx.theme.overrideTokens()`（令牌层，可选补充）

```ts
ctx.theme.overrideTokens(source: string, tokens: ThemeTokenOverrides): () => void
```

- 以"层"的方式叠加部分令牌覆盖，不改注册表，由主题呈现器统一施加到文档。
- 相关：`ctx.theme.getTheme()`、`setTheme(id)`、`setFontSize(px)`，事件 `theme/change`。
- 适用：希望用户用**语义令牌**而非选择器来自定义时（如只改配色），且能自动获得 light/dark 正确性。
- 不建议作为本插件主通道：它**无法表达任意选择器**，与"用户 CSS 片段"的定位不符。可作为二期增强（让用户选择"令牌模式"）。

### 4.4 不可用 / 不推荐的路径

| 路径                                                    | 判定                                                                                                   |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `root` / `shell.overlay` 等槽位注册组件来注入 `<style>` | 可行但**不必要**：槽位是渲染席位，会引入 React 生命周期与重渲染复杂度；样式注入属副作用，直接 DOM 更稳 |
| 覆盖 `:root` 令牌而不加特异性                           | ❌ 会被内置 `:root` 规则覆盖（`var()` 按声明元素解析，必须落在 `:root` 或更高）                         |
| 用 `harness.handle` / `host.call` 传 CSS                | 动态通道专属，模块通道不适用                                                                           |

---

## 5. 核心进路：双层注入

### 5.1 分层职责

```
第 1 层（Host / index-inject）——「关键抑制层」
  内容：极少量、必须在首帧前生效的 CSS（根令牌覆盖、底色、隐藏、防闪烁）
  位置：<head> 首部         源序：劣势 → 用 :root:root 加倍特异性补足
  体积：设上限（建议 ≤ 8–16 KB），避免拖慢 HTML 首包

第 2 层（Client / head 追加）——「主体层」
  内容：用户完整 CSS 片段
  位置：document.head 末尾   源序：优势 → 无需特异性技巧即可覆盖内置样式
  生命周期：随插件卸载/热重载自动清理
  更新：订阅配置变更即时重写 textContent（不重建标签，避免闪烁）
```

**为什么两层都要**：只有第 2 层 → 首帧到插件加载之间存在**无样式闪烁（FOUC）**；只有第 1 层 → 用户规则**被内置样式覆盖**，插件形同失效。两层叠加同时拿到"无闪烁"与"能覆盖"。

### 5.2 数据与配置通路

```
~/.dsh/profiles/desktop/cordis.patch.yml        ← 用户设置落盘位置（native 编辑目标）
        ↑ settings.mutate() 写入
Host: settings 服务 ── Config schema（z.object，字段 .volatile() 表示热更新）
        ↓ 配置变更 → Config 引用更新
Host: index-inject 监听器读取最新值 → 渲染进 <head>
        ↓
Client: ctx.configForms.get('dsh-custom-css').getSnapshot() 读取
        → subscribe() 订阅 → 重写第 2 层 <style>.textContent
```

配置热更新链路（源码确认）：

- `dsh-hmr` 的 `watchConfig` 监听 profile patch 文件，变更（含 `add`/`change`/`unlink`，开启 `awaitWriteFinish`）即触发 `refresh()` → Loader 条目配置热更新，**无需重启**。
- `settings.prepareDocument()` 的说明即为"定位 profile patch 以进行原生编辑"，印证落盘位置。

### 5.3 配置项设计（建议）

| 字段          | 类型    | 说明                                                  |
| ------------- | ------- | ----------------------------------------------------- |
| `css`         | string  | 用户 CSS 主体文本                                     |
| `enabled`     | boolean | 总开关，便于排障（CSS 写坏时可一键关闭）              |
| `criticalCss` | string  | 可选，首屏关键层；留空则不注入第 1 层                 |
| `scope`       | enum    | 可选：`global` / `light` / `dark`，便于用户按主题书写 |

> 建议：`css` 用 `z.string()` 且**不加 `.pattern()` 白名单**（CSS 内容形态无限），改为在客户端做**安全闸**（见 §6）。

### 5.4 客户端注入骨架（示意，非最终代码）

```js
function apply(ctx) {
  const tag = document.createElement('style')
  tag.dataset.plugin = '@local/dsh-custom-css'          // 加载器按此归属与清理
  tag.dataset.pluginCss = '@local/dsh-custom-css/user.css'
  document.head.appendChild(tag)

  const form = ctx.configForms.get(SETTINGS_NAMESPACE)
  const render = () => {
    const v = form.getSnapshot().value
    tag.textContent = v?.enabled === false ? '' : String(v?.css ?? '')
  }
  render()
  ctx.effect(() => form.subscribe(render), 'custom-css: live stylesheet')
  ctx.effect(() => () => tag.remove(), 'custom-css: style cleanup')
}
```

注册要求（已核实）：

- `package.json` 必须有 `"dsh": { "client": { "platform": "web", … } }` **且** `exports["./client"]` 指向产物文件，否则加载器抛错：*declares dsh.client but exports no "./client" bundle*。
- 客户端 `apply` 的 `inject` 需含 `configForms`（`dsh-font-settings` 用 `inject: ['slots','locale','theme','configForms']`）。
- Host 半需 `ctx.inject(['settings'], c => c.effect(() => c.settings.configure({ auto: false }, ctx.fiber)))` 以声明设置归属。

### 5.5 目录与打包（对齐既有插件，无构建步骤）

沿用 `dsh-font-settings` 的**零构建**约定：客户端产物以手写/提交的 `client.js` 形式直接放在包根，`exports["./client"]` 指向它。

```
dsh-custom-css/
├── package.json          # name/@local/dsh-custom-css, exports["./client"], dsh.bundle + dsh.client
├── cordis.patch.yml      # - insert: [{ id: dsh-custom-css, name: '@local/dsh-custom-css' }]
├── index.js              # Host 半：Config schema + index-inject 关键层
├── client.js             # 客户端半：__ModuleLoader__.load({ id, factory(require){…} })
├── locale/
│   ├── zh.json           # 设置界面中文文案
│   └── en.json
├── icon.svg              # 插件列表图标
└── README.md
```

接入 profile（两步，均为既有机制）：

1. `~/.dsh/profiles/desktop/package.json` 的 `dependencies` 加 `"@local/dsh-custom-css": "link:/…/local-plugins/dsh-custom-css"`，并加入 `dsh.profile.bundles`。
2. `~/.dsh/profiles/desktop/cordis.patch.yml` 由插件自带 patch 的 `insert` 条目完成装载（bundle 机制自动叠加）。

### 5.6 最终实现（与上述方案的差异）

需求澄清后确定的实现，与 §5.1–5.5 的差异如下。

**① 注入只有客户端一层，且必须如此。**

探究阶段判断「Host 关键层 + 客户端主体层」两层叠加最优。实测后确认，**Host 层根本给不出需要的位置**：

| 注入行         | 类型定义允许的 placement | 实际落点                                          |
| -------------- | ------------------------ | ------------------------------------------------- |
| `kind:'style'` | 字段不存在，源码硬编码   | `<head>` 开标签紧后面                             |
| `kind:'html'`  | `'head' \| 'body'`       | head → 开标签紧后面；body → `<body>` 开标签紧后面 |

也就是说注入系统**没有「`<head>` 末尾」这个概念**。用真实的 `renderIndexInjections` 渲染线上 `index.html` 模板，把 3 种行一起推进去，输出为：

```html
<head><style>/*style-kind*/</style><!--html-kind-head-->
    … <link rel="stylesheet" href="./assets/index-BPHePDI_.css">
  </head>
```

两种 head 行都落在内置样式表**之前**，同特异性下必然被覆盖。因此：
- 只做 Host 注入 → 用户 CSS 静默失效（复现了 §3.2 的结论）；
- 客户端 `document.head.appendChild` → 落在内置样式表**之后**，正是所需位置。

最终实现采用后者。这不是退让：**DSH 自己的全部内置客户端插件都用这一写法**（`dsh-client-ui-jobs` 等产物中 `document.createElement("style")` + `data-plugin` + `head.appendChild`）。

**② 无 `enabled` 总开关，无令牌模式。** 按澄清意见：不要令牌；开关以「清空 `css` 字段」代替，README 记录自救方法。

**③ 外链闸门（新增需求）。** 保存前与生效前各扫描一次，`@import` 与 `url()` 中的外部引用一律拦截并报行号。判定：带协议或协议相对即外部，相对/根绝对路径放行。注释内容不参与判定。

**④ 设置行位置 `order: 11.5`。** 实测该槽位占用顺序：`font-size` 11 → `font-sans` 11.1 → `font-mono` 11.2 → **11.5（本插件）** → `transcript-view` 12 → `developer-tools` 15 …

**⑤ 文案内联在 `client.js`**，随 `ctx.locale.register` 注册；不产出 `locale/*.json`（那些文件供插件元信息展示，运行时不加载）。

**⑥ 实际文件清单**：`package.json`、`index.js`、`client.js`、`cordis.patch.yml`、`icon.svg`、`README.md`、`FEASIBILITY@0.2.0-rc.2.md`、`node_modules/`（自带的 `@deepseek-ai/schemastery`）。

**⑦ 三个名字是三件独立的事。**

| 名字                   | 值                                             | 谁在什么地方用                                   |
| ---------------------- | ---------------------------------------------- | ------------------------------------------------ |
| 包名 / 目录            | `@local/dsh-custom-css` / `dsh-custom-css`     | 模块解析；profile 的 `dependencies` 与 `bundles` |
| 条目 id / 设置命名空间 | `dsh-custom-css`                               | 设置文档里的键；改名会丢掉用户已保存的配置       |
| **界面显示名**         | `locale/*.json` 的 `meta.title` → 「用户 CSS」 | 插件页面上的名称                                 |

**显示名既不来自包名也不来自条目 id**，而由 Host 的 `readPluginMeta` 从 `locale/<语言>.json` 读取：经 `exports["./locale/*.json"]` 解析，`locale/en.json` 为锚点，缺失时才回退到 `package.json` 的 `name`。`dsh-font-settings` 在插件页显示为「字体」正是靠这个机制。本插件照此补上 `locale/{en,zh}.json`，并恢复了 `exports["./locale/*.json"]`。

> 命名踩坑记录：`index.js` 导入 `@deepseek-ai/schemastery`，而 profile 不提供该包。首次注册时插件在列表里显示「已启用」但 `fiberPhase: null`，即 Host 半导入失败。修法是让插件自带依赖（`pnpm add @deepseek-ai/schemastery@3.18.4`），与 `dsh-font-settings` 自带 `node_modules` 的做法一致。**Node 会永久缓存「导入失败」的结果**，所以修好后必须重启 Host，无法在进程内重试。

---

## 6. 风险与对策

| 风险                                                              | 影响                              | 对策                                                                                                                   |
| ----------------------------------------------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **源序陷阱**：只做 Host 注入                                      | 用户 CSS 静默失效                 | 主体走客户端注入（本方案已规避）                                                                                       |
| **CSS 破坏界面**（如 `display:none` 误伤、`position:fixed` 遮挡） | 界面不可用、难以自救              | ① 提供 `enabled` 总开关；② 首屏关键层只放"安全"CSS；③ 客户端注入前做基础校验；④ README 说明"改 profile patch 即可停用" |
| **`url()` 外链**泄露请求                                          | 隐私/离线失败                     | 明确策略：允许（用户自担）或过滤 `@import`/`url(http…)`；建议**默认警告、不硬拦**                                      |
| **体积过大**拖慢首包                                              | 首屏变慢                          | 关键层设体积上限并在超限时截断 + 提示（沿用 font-settings 的"限长"思路）                                               |
| **全局 style 认领误伤**                                           | 极低概率把他人标签归到自己名下    | 主动预设 `data-plugin`，不依赖兜底认领                                                                                 |
| **CSP** 限制内联样式                                              | 注入被浏览器拒绝                  | 已验证不可行性较低：`kind:'style'` 是官方注入通道且 `dsh-font-settings` 在用；实现后需在目标环境实测确认               |
| **热重载丢状态**                                                  | 编辑插件代码时组件状态丢失        | 本插件为无状态副作用，热重载代价可忽略；用户 CSS 文本存于 Host 设置，不受影响                                          |
| **多插件令牌冲突**                                                | 与 `dsh-font-settings` 等互相覆盖 | 用户 CSS 位于源序最后 → 天然优先；如需共存，令牌类自定义建议走 `theme.overrideTokens` 分层                             |

---

## 7. 备选方案对比

| 方案                          | 无闪烁 | 能覆盖内置样式 | 热更新     | 清理       | 结论                   |
| ----------------------------- | ------ | -------------- | ---------- | ---------- | ---------------------- |
| 仅 Host `index-inject`        | ✅      | ❌（源序劣势）  | 需重载页面 | 自动       | 不足                   |
| 仅 Client `<style>` 追加      | ❌ FOUC | ✅              | ✅ 即时     | 自动       | 不足                   |
| **双层（本方案）**            | ✅      | ✅              | ✅          | ✅          | **推荐**               |
| `theme.overrideTokens` 令牌层 | ✅      | 仅令牌可及范围 | ✅          | 自动       | 作为二期"令牌模式"补充 |
| 直接改写内置样式表            | ✅      | ✅              | ❌          | ❌ 破坏升级 | 拒绝                   |

---

## 8. 决策点（已确认）

| #   | 决策点                              | 结论                                                                                                                                             |
| --- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | 首屏关键层是否需要（`criticalCss`） | **不需要**。只做客户端单层。                                                                                                                     |
| 2   | 是否提供设置界面                    | **需要**：`settings.general.item` 单行，位置在字体设置之后、工作步骤显示之前；参照界面字体设置的「摘要 + 展开」形态，展开后为文本框 + 保存按钮。 |
| 3   | 外链资源策略                        | **拦截**：只允许本地文件，出现其他情况警告并阻止生效。                                                                                           |
| 4   | 是否需要「令牌模式」                | **不需要**。                                                                                                                                     |

补充确认：

- 注入方式明确为**客户端 `document.head.appendChild`**，落在 `<head>` 末尾。
- 保存后**即时生效，不触发页面刷新**。
- 不做 CSS 校验与 lint（第 3 点的外链闸门除外）。

---

## 9. 实施步骤（获批后执行）

实施记录：第 1–5、7 步已完成；第 6 步的「重启 Host」为**必要步骤**，尚未由用户执行（bundle 列表在 Host 启动时合成）。

1. 建包骨架：`package.json`（`exports["./client"]` + `dsh.bundle` + `dsh.client`）、`cordis.patch.yml`、`icon.svg`。

2. 写 Host 半 `index.js`：`z` Config（仅 `css` 字段）、`settings.configure`。无 `webserver/index-inject` 层。
3. 写客户端半 `client.js`：`__ModuleLoader__.load` + `factory`，样式标签注入、外链扫描、`configForms` 订阅、设置行组件、字典注册、清理。
4. 注册 `settings.general.item` 行（`id: 'custom-css'`, `order: 11.5`）。
5. 本地接入 profile：link 依赖 + `bundles` 条目 + `pnpm install`。
6. **验证（待用户执行）**：重启 Host → 刷新 GUI → 打开 设置 → 通用 → 确认「用户 CSS」行出现在字体设置之后、工作步骤显示之前 → 保存一段 CSS 确认立即生效 → 试一段 `url(https://…)` 确认被拦截。
7. 补 `README.md`（含"写坏了怎么自救"）。

### 已验证项（不依赖重启）

- `node --check` 通过；`package.json` JSON 合法。
- 外链扫描器 25 条用例全通过（含外部/本地/注释/行号/去重/大小写）。
- 在 DOM 与 Cordis 桩下跑通完整生命周期：4 个 effect 注册、槽位注入 `order=11.5`、`<style>` 带 `data-plugin` + `data-plugin-css` 追加、外部片段被扣留（`textContent` 为空）、干净片段实时写入、`form.set` 保存后样式更新。
- 三种 UI 状态渲染树正确：折叠态 / 草稿含外部引用（分行报错）/ 已保存被拦截而草稿已改干净。


---

## 10. 参考坐标

| 对象                        | 路径 / 标识                                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------------- |
| 现有同构插件（照抄结构）    | `local-plugins/dsh-font-settings/`（`index.js`、`client.js`、`package.json`）                           |
| 注入行渲染器                | `app.asar` → `dsh/node_modules/@deepseek-ai/dsh-host-webserver/lib/index.js`（`renderIndexInjections`） |
| 客户端模块加载器 + 样式认领 | `…/dsh-client-modules/lib/index.js`（`claimStyles`、`removeOwnedStyles`）                               |
| 设置表单客户端服务          | `…/dsh-client-ui-settings/lib/client.js`（`ConfigForms`、`ConfigFormController`）                       |
| 配置热更新监听              | `…/dsh-hmr/lib/index.js`（`watchConfig`）                                                               |
| 本机 profile                | `~/.dsh/profiles/desktop/{package.json,cordis.patch.yml}`                                               |
