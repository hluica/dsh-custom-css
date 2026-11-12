# @local/dsh-custom-css — 用户 CSS

最后实质性修改于Harness版本：0.2.1-rc.3

向 DeepSeek Harness 界面注入用户自定义 CSS 片段。设置 → **通用** 中新增一行「用户 CSS」（位于字体设置之后、工作步骤显示之前），展开后编辑片段，点「保存并应用」即时生效。

---

## 使用

1. 打开 **设置 → 通用**，找到「用户 CSS」行。
2. 点右侧摘要按钮展开编辑器，在文本框中写 CSS。
3. 点 **保存并应用**。样式立即生效，**不需要刷新页面或重启**。

摘要按钮显示注入状态：未保存任何片段时为「未注入」，否则为「已注入」。编辑器下方的按钮旁会显示是否有未保存的修改。

文本框下方另有一行提示：按 **F12** 可打开 DevTools，用于快速查看 DeepSeek Harness 当前使用的界面源代码（包括你自己注入的 CSS）。

## 生效位置与优先级

片段被写入一个 `<style>` 元素，追加在 `document.head` **末尾**。

这一点是本插件的核心。内置样式表（`assets/vendor-*.css`、`assets/index-*.css`）已经占据 `<head>`；只有追加在它们**之后**的样式表，才能在**同特异性**下赢得层叠。因此：

```css
/* 直接写选择器即可覆盖内置样式，无需 !important */
.dsw-sidebar { border-right: 1px solid #888; }
```

作为对比，Host 端的 `webserver/index-inject` 注入只能落在 `<head>` 开标签**紧后面**（`renderIndexInjections` 对 `head` 行的固定行为），位于内置样式表**之前**，同特异性下会被覆盖。这正是本插件把注入放在浏览器端的原因。

## 与主题样式表的先后顺序

`@deepseek-ai/dsh-client-ui-theme` 在 `apply()` 时把调色板作为 `<style>` 追加到 `head`，并在主题变化时重写。本插件保证用户样式表**始终排在主题样式表之后**：

- 插件声明 `inject: [... , 'theme']`，因此主题服务先就绪；
- `apply()` 里把已有的 `<style>` 节点再 `appendChild` 一次（同一节点会被**移动**而非复制），使之外观上位于 `head` 末尾；
- 监听 `theme/change`，主题重写调色板后再次后置，避免用户样式表被新插入的主题样式表挤到前面。

### 一个必须澄清的要点：`var()` 本身与顺序无关

**自定义属性是在计算值阶段按元素解析的，与样式表先后顺序无关。** 也就是说，即使本插件的样式表排在主题之前，`var(--dsw-alias-bg-base)` 依然能取到主题的值——只要该元素能从祖先（主题把变量声明在 `body` 上）继承到这个变量。

所以上面的顺序保证解决的是**另一件事**：当用户规则与主题规则**特异性相同、属性相同**时的层叠归属。例如主题自己有 `body{background-color:var(--dsw-alias-bg-base)}`，用户在 `body{background-color:…}` 里想改底色，同特异性下**后出现的胜出**——本插件排在最后，用户即胜出。

结论：**使用内置颜色变量不需要依赖加载顺序**，本节的后置只是让"同特异性覆盖主题"这件事稳定成立。

## 使用内置颜色变量（自动随深浅色切换）

主题在 `body` 上定义约 **190** 个语义化变量，浅色与深色各一套；深色通过 `body[data-ds-dark-theme]` 覆盖。在自定义 CSS 里引用它们即可自动适配：

```css
.my-panel {
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-layer-2);
  border: 1px solid var(--dsw-alias-border-l2);
}
```

常用变量及其浅/深取值：

| 变量 | 用途 | 浅色 | 深色 |
| --- | --- | --- | --- |
| `--dsw-alias-bg-base` | 应用底色 | `…bluish-00` (#fff) | `…bluish-950` (#151517) |
| `--dsw-alias-bg-layer-1/2/3` | 分层表面 | `bluish-00` | `bluish-875/850/800` |
| `--dsw-alias-bg-overlay` | 浮层 | `bluish-150` | `bluish-700` |
| `--dsw-alias-bg-module-platform` | 控件底色 | `bluish-60` | `bluish-800` |
| `--dsw-alias-label-primary` | 主文字 | `bluish-1000` (#0f1115) | `bluish-50` (#f9fafb) |
| `--dsw-alias-label-secondary` | 次文字 | `bluish-700` | `bluish-300` |
| `--dsw-alias-label-tertiary` | 三级文字 | `bluish-600` | `bluish-400` |
| `--dsw-alias-label-primary-foreground` | 主按钮上的文字 | `bluish-00` | `bluish-1000` |
| `--dsw-alias-border-l1` … `l4` | 边框（由弱到强） | `#0000000a` → `#00000029` | `#ffffff0f` → `#fff3` |
| `--dsw-alias-brand-primary` | 品牌主色 | `bluish-1000` | `bluish-50` |
| `--dsw-alias-link` | 链接 | `deepseek-500` | `deepseek-400` |
| `--dsw-alias-state-error-primary` | 错误 | `red-600` | `red-400` |
| `--dsw-alias-state-success-primary` | 成功 | `green-500` | `green-500` |
| `--dsw-alias-state-warn-primary` | 警告 | `amber-500` | `amber-500` |
| `--dsw-alias-interactive-bg-hover` | 悬停底色 | `#2631480f` | `#ffffff14` |
| `--dsw-alias-markdown-code-block` | 代码块底 | `bluish-50` | `bluish-900` |
| `--dsw-specific-sidebar-fill` | 侧栏底色 | `bluish-50` | `bluish-900` |
| `--dsw-alias-tooltip-bg` | 提示气泡 | `bluish-850` | `bluish-750` |

还有 `--dsw-static-*` 静态色阶（不随主题变化）与 `--dsw-font-*` 字排变量。**完整清单**请在 DevTools 里查看 `body` 的计算样式，或用设置里的插件行编辑框旁提示的方式检索。

> 不要用 `@media (prefers-color-scheme: dark)` 判断深浅色：DSH 用 `body[data-ds-dark-theme]` 属性切换（主题偏好可为 `system`，但落地形式仍是该属性）。需要分主题写样式时请针对该属性，或直接使用上面的变量。

## 只允许本地文件

保存和生效前都会扫描片段。以下情况会被**拦截**并给出行号报告，**当前 CSS 不生效**：

- `@import` 引用外部资源（含 `url()` 与字符串两种写法）
- `url()` 引用外部资源

判定规则：带协议（`http:`、`https:`、`data:`、`file:`、`blob:`、`ftp:` 等）或协议相对（`//host/…`）即视为外部。

| 写法 | 结果 |
| --- | --- |
| `url(./x.png)`、`url(../x.png)`、`url(/abs/x.png)`、`url(#grad)` | ✅ 允许 |
| `url(https://…)`、`url(//host/…)`、`url(data:…)`、`url(file:…)` | ❌ 拦截 |
| `@import "https://…"`、`@import url(https://…)` | ❌ 拦截 |

注释中的引用不会被误判。除该限制外，**不做任何 CSS 语法校验或格式化**。

## 写坏了怎么自救

- 编辑器内：点「放弃修改」丢弃未保存的草稿。
- 片段导致界面不可用：直接编辑 `~/.dsh/profiles/desktop/cordis.patch.yml`，把 `css` 清空（或删除整个条目），保存后 Host 会热加载，无需重启。

```yaml
- id: dsh-custom-css
  name: "@local/dsh-custom-css"
  config:
    css: ''          # 清空即恢复原样
```

## 结构

| 文件 | 作用 |
| --- | --- |
| `index.js` | Host 半：持有设置命名空间 `dsh-custom-css` 与字段 `css`。不做校验，不注入 HTML |
| `client.js` | 客户端半：`<style>` 注入、外链扫描、设置行组件、字典 |
| `cordis.patch.yml` | bundle 挂载声明（把条目插入 profile 配置树） |
| `locale/zh.json`、`locale/en.json` | **插件页面的显示名与说明**（见下） |
| `icon.svg` | 插件页面图标 |
| `package.json` | `exports["./client"]` + `exports["./locale/*.json"]` + `dsh.client` + `dsh.bundle` + 构建脚本 |
| `deps.lock.json` | 运行期依赖锁定：精确版本、tarball integrity、每个包**只留哪些文件** |
| `scripts/build.mjs`、`scripts/verify.mjs`、`scripts/lib/` | 依赖物化与不变量检查（见「[依赖与构建](#依赖与构建)」） |
| `node_modules/` | **构建产物**：真实文件，无符号连接。由 `npm run build` 生成，勿手工增删 |
| `.cache/` | tarball 缓存（`npm run clean` 一并删除）：让重建不必联网 |

### 插件页面显示名从哪来

插件列表里显示的**不是包名**，而是 `locale/<语言>.json` 里的 `meta.title` / `meta.description`：

```json
{ "meta": { "title": "用户CSS", "description": "在「通用」设置中增加一行，…" } }
```

三条约束（都由 Host 的 `readPluginMeta` 强制）：

1. 必须经 `exports["./locale/*.json"]` 导出，否则解析不到；`locale/en.json` 是**锚点**，缺失则不读任何语言文件。
2. 语言文件名必须是合法语言 id（`zh.json`、`en.json`），且所有语言文件与 `en.json` 同目录。
3. 缺少 `meta.title` 时回退到 `package.json` 的 `name`，再回退到模块说明符——这正是「显示了包名」的原因。写错会在插件页面上显示一条元数据错误。

图标来自 `package.json` 的 `icon` 字段，指向包内 SVG/PNG/JPEG/WebP，上限 256 KiB。

关于命名空间：`dsh.client` 的 `inject` 列表用的是**包名**（`@deepseek-ai/dsh-client-*`），而 `index.js` 里 `settings.configure` 用的命名空间是**条目 id**（`dsh-custom-css`）。两者不同，不要混用。

**包名与条目 id 是有意分开的**：包名 `@local/dsh-custom-css` 是模块标识；条目 id `dsh-custom-css` 是设置文档里的键，改名会丢掉用户已保存的配置，因此保持不变；而**界面上显示的名称由 `locale/*.json` 决定**，与这两者都无关。

## 依赖与构建

Host 半 `import z from '@deepseek-ai/schemastery'`，而 profile 不提供这个包，所以插件必须自带一份。**自带的方式是真实文件，不是符号连接**：

```
node_modules/@deepseek-ai/schemastery/{package.json,LICENSE,lib/index.mjs,lib/index.cjs}
node_modules/@deepseek-ai/cosmokit/{package.json,LICENSE,lib/index.js}
node_modules/.dsh-vendor.json          # 构建凭据：锁文件摘要 + 每个文件的 sha256
```

为什么不用包管理器的默认布局：pnpm 的 isolated linker 把依赖做成 `node_modules/.pnpm/**` 里的一串符号连接，`node_modules/@deepseek-ai/schemastery` 只是一条指向虚拟商店的链接。这个目录一旦被复制、打包或被 Finder 处理，链接就可能断掉或变成**替身（alias）**——而 Host 半导入失败会被 Node 永久缓存，只能重启重试（见「[故障排查](#故障排查)」）。本插件用 7 个真实文件换掉整棵链接树：解析结果完全一致（也正是 DSH 自己在 `app.asar` 里附带的那份字节），但复制到哪都能用。

### 什么时候要动它

`node_modules/` 是**产物**，`index.js` / `client.js` 是**源码**。这条分工决定了日常怎么用：

| 你改了什么 | 要做什么 |
| --- | --- |
| `index.js`、`client.js`、`locale/*.json`、`icon.svg`、`cordis.patch.yml` | **什么都不用做**。它们不是构建产物：客户端半由 HMR 重载，CSS 本来就在设置里热生效 |
| `package.json` 的 `dependencies`，或 `deps.lock.json` | `npm run build`，然后**重启 Host**——Host 半的模块已被缓存，依赖换了不会热生效 |
| 要判断「这个插件现在是健康的吗」 | `npm run verify`。**让用户重启 Host 之前先跑它**，比重启完再发现「已启用但未运行」便宜得多 |
| 要加或换一个运行期依赖 | `node scripts/build.mjs --pin <name>@<version>`，见「[新增 / 升级依赖](#新增--升级依赖)」 |

### 命令

| 命令 | 作用 |
| --- | --- |
| `npm run build` | 按 `package.json` + `deps.lock.json` 物化依赖，然后跑一遍 `verify` |
| `npm run verify` | 只检查：真实文件不变量、依赖与锁逐字节一致、`package.json` 的 DSH 契约、Host 半能否导入 |
| `npm run rebuild` | 即 `build --force`：即使树已是最新也重写一遍 |
| `npm run clean` | 删除 `node_modules/` 与 `.cache/` |

`build` 的顺序是：解析 `package.json` → `deps.lock.json` 的依赖闭包 → 从缓存或 registry 取 tarball（**逐个校验 sha512 integrity**）→ 只解出白名单里的文件 → 整棵替换 `node_modules/` → 清掉 macOS 边角文件 → 运行 `verify`。**所有下载与校验都在旧树被删之前完成**，所以断网或 integrity 不符时旧树原封不动。

| 选项 | 作用 |
| --- | --- |
| `--offline` | 只用 `.cache/tarballs/`，不联网（首次构建后即可离线重建） |
| `--registry=<url>` | 换源，例如 `--registry=https://registry.npmmirror.com`；integrity 仍按锁文件校验，镜像给了不同字节就失败 |
| `--pin <name>@<version>` | 从 registry 取这个版本的 `resolved`/`integrity`/依赖边写进锁，然后照常构建 |
| `--force` | 无视「已是最新」，强制重写整棵树 |
| `--no-verify` | 只构建不校验（调试用） |

### 新增 / 升级依赖

手抄 integrity 是这套东西里唯一容易做错、也最容易让人绕过去的一步，所以让构建自己去问 registry：

```bash
node scripts/build.mjs --pin @deepseek-ai/schemastery@3.19.0   # 已有条目：只更新版本相关字段
node scripts/build.mjs --pin semver@7.7.2                     # 新条目：自动写入 resolved/integrity/依赖边
```

`--pin` 写入的是 **registry 的事实**（`resolved`、`integrity`、该包自己声明的依赖边），不碰**人的判断**：已有条目的 `vendor` 白名单与 `note` 原样保留。它同时把两件需要人决定的事说出来——新条目的 `vendor` 先给 `"*"`（全量保留，跑通后再裁），以及声明的依赖边里还有谁没有 pinned 条目。

于是升级或新增的完整流程是：

1. 先 `--pin <name>@<精确版本>`；如果这个包是插件直接依赖的，再把同样的精确版本写进 `package.json` 的 `dependencies`（两边顺序随意，缺哪边都会被指名报错）。
2. 若该包自己声明了依赖（schemastery 就声明了 cosmokit 与 `@standard-schema/spec`），按提示 `--pin` 那些包。锁里**每个包只有一个 pinned 版本**，依赖边按**名字**解析，所以范围不存在「要不要重新解一遍」的问题：钉住哪个版本是人的决定，构建只负责如实记录并校验。
3. `npm run build`。白名单写错、包换了形状、integrity 不符，都会在写入前报错，并列出 tarball 里实际有什么。

`vendor` 白名单是「优化」的落点：已发布 tarball 里的 README、`lib/types/`、`src/`（TypeScript 源码）运行期永远不会被加载，因此不进树——三个包解包后 202 KiB / 40 个文件，进树的是 66 KiB / 7 个文件。三种取值：

| 取值 | 含义 |
| --- | --- |
| `["package.json", "LICENSE", "lib/index.mjs", …]` | 显式白名单：只留这些文件（本插件当前用法，靠 `build` 与 `verify` 保证不漏） |
| `"*"` | 全量保留：新 pin 的默认值。先保证 import 链完整（入口 import 兄弟文件时不会被裁坏），跑通后再收窄 |
| `[]` | 一个字节都不装：包在闭包里只为把依赖图画完整 |

`@standard-schema/spec` 就是 `[]`：它在闭包里（schemastery 确实声明了 `^1.1.0`），但它是**纯类型**依赖，两个构建产物都没引用它，所以一个字节都不装——锁里仍记着它，闭包才是完整的。

### `verify` 检查什么

- 整个插件目录（含 `node_modules/`）**没有符号连接、没有 Finder 替身、没有 `.DS_Store`/`._*`**。替身靠内容签名（`book` 魔术字）识别，因为它是普通文件，链接检查看不见它。
- `node_modules/` 里没有 `.pnpm`、`.modules.yaml`、`.bin` 等包管理器痕迹。
- 锁的形态自洽：每个包只 pinned 一次、每个包声明的依赖边都有对应条目、每个 pinned 包都被 `package.json` 的闭包真正需要（没有留错版本的死条目）。失败信息里直接给出该跑的那条 `--pin` 命令。
- 依赖树每个文件与 `.dsh-vendor.json` 里的 sha256 **逐字节一致**，多一个少一个都算漂移。
- `exports`、`dsh.bundle.patch`、`dsh.client`、`locale/en.json` 锚点、图标大小（≤256 KiB）、`files[]` 都满足 DSH 读取时的要求；patch 里的 `id` 必须等于 Host 半的 `SETTINGS_NAMESPACE`（改名会丢已保存的配置）。
- `index.js`、`client.js` 能被 `node --check` 解析。
- **Host 半在一个全新进程里真的能导入**，并检查 `Config({}).css.get() === ''`、`apply()` 是否 `inject(['settings'])` 后 `settings.configure({auto:false}, ctx.fiber)`。

最后一条是这套东西里最值钱的一项：它把「插件显示已启用、状态却不是运行中」提前到构建阶段暴露，而不是等重启 Host 之后才发现。

### 与包管理器共存

`node_modules/` 是**构建产物**，不要在里面手工装东西——`build` 会整棵替换它（替换前会列出被删掉的非托管条目）。`pnpm-workspace.yaml` 只是一道保险：万一在这里跑了 `pnpm install`，`nodeLinker: hoisted` + `packageImportMethod: copy` 保证结果仍是平铺的真实目录，不会退回符号连接。

`package.json` 里的 `dependencies` 同时也是给 DSH 插件管理器用的：从路径或 registry 安装时由它把依赖装进 profile（profile 自己设了 `nodeLinker: hoisted`，不产生符号连接）。profile 用 `link:` 挂载本目录那条连接属于 profile 的接线，不在本包内——本包内部没有任何链接。

### 构建系统与它的参考副本

本插件的 `scripts/` 是一套完整构建系统（依赖物化 + 不变量检查），它跟着插件走，所以这个目录单独复制出去仍能构建与自检；整体说明见工作区根目录的 [`BUILD-SYSTEM.md`](../BUILD-SYSTEM.md)。

其中除 `host-contract.mjs` 之外的 5 个文件（`build.mjs`、`verify.mjs`、`lib/fsx.mjs`、`lib/tar.mjs`、`lib/probe-runner.mjs`）是根目录 [`build-system/scripts/`](../build-system/scripts) 这份**参考副本**的逐字节副本：改构建系统要改参考副本，再 `node build-system/sync.mjs` 同步下来。`verify` 每次都核对这件事，不一致会指名并给出那句命令。

`scripts/host-contract.mjs` 是**本插件自己的**（`sync` 永不覆盖）：它就是「这个 Host 半向 DSH 承诺了什么」的那组断言——本插件断言 `SETTINGS_NAMESPACE`/`CSS_FIELD` 两个键名、`css` 字段的 volatile 形态与默认值、片段逐字节穿过校验，以及 `apply()` 是否 `inject(['settings'])` → `settings.configure({auto:false}, ctx.fiber)`。`verify` 会把它们的每一条连同通用不变量一起打印（这就是「`verify` 检查什么」里最后一条的实现）。

### 运行期版本契约

`peerDependencies` 只声明一条 `@deepseek-ai/dsh`。DSH 的 profile 装载与插件管理器会专门检查 `@deepseek-ai/dsh` 与 `@deepseek-ai/dsh-*` 形式的 peer：不满足就**跳过该 bundle**（而不是静默崩溃）。当前 DSH 是 `0.2.1-rc.3`，`^0.2.0-rc.2` 满足它。日后 DSH 升到 0.3 时本插件会被跳过并在插件页报错；确认可用后按提示用 `dsh plugin allow-version` 或插件页给这一对版本开豁免。

## 实现说明

- **注入时机**：`<style>` 在工厂函数体内创建并追加（即模块被浏览器物化时），与所有内置客户端插件一致，保证 React 首帧前样式就位。
- **标签归属**：预设 `data-plugin="<包名>"` 与 `data-plugin-css="<包名>/user.css"`，与模块加载器的清理与热重载记账对齐，避免落入它对未标记 `<style>` 的兜底认领。
- **更新方式**：保存后只改写 `textContent`，不重建标签，因此不会二次重排。
- **生效闸门有两道**：保存前拦截不合规草稿；生效前再扫一次，所以直接手改 profile patch 塞进去的外部引用同样不会生效。

## 注册方式（已完成）

`~/.dsh/profiles/desktop/package.json`：

```json
"dependencies": {
  "@local/dsh-custom-css": "link:/Users/hanluica/Documents/deepseek-harness/local-plugins/dsh-custom-css"
},
"dsh": { "profile": { "bundles": [ "…", "@local/dsh-custom-css", "…" ] } }
```

profile 配置树的改动在 Host **启动时**合成，因此新增 bundle **需要重启 Host** 才会加载；此后的 CSS 编辑与保存都是热生效，不再需要重启。

## 已知限制

- 只作用于 Web 客户端界面；终端（xterm）内部由 canvas 渲染，不受 CSS 影响。
- 深色/浅色主题由 `[data-ds-dark-theme]` 属性切换（不是 `prefers-color-scheme`），需要分主题时请针对该属性写选择器。
- 极长的片段会增大渲染期样式计算成本；编辑器文本框可滚动，但不做长度截断。

## 故障排查

### 插件列表显示「已启用」，但状态不是「运行中」

Host 半导入失败时就是这个表现（`fiberPhase: null`：已启用、未运行）。最常见原因是**运行期依赖缺失、被改动或被换成了链接**。

```bash
cd <插件目录>
npm run verify      # 在全新进程里导入 Host 半，失败会打印真正的原因
npm run build       # 按 deps.lock.json 重新物化依赖：缺文件、被改过、链接化都能修
```

`index.js` 导入 `@deepseek-ai/schemastery`，而 profile 不提供它——插件必须自带（就是上面那 7 个真实文件；`dsh-font-settings` 同样自带 `node_modules`）。用下面这条命令从 **profile 那边**确认整条解析链：

```bash
cd ~/.dsh/profiles/desktop
node --input-type=module -e "await import('@local/dsh-custom-css'); console.log('OK')"
```

**关键**：Node 会**永久缓存「导入失败」的结果**，因此已运行的 Host 无法重试——修好依赖后**必须重启 Host** 才能激活。这不是热更新能覆盖的情形。（`npm run verify` 之所以另起子进程导入，就是为了绕开这条缓存，给出可重复的答案。）

