# DSH 用户 CSS 插件 —— 0.2.1-rc.3 更新记录

- 目标插件：`@local/dsh-custom-css`，目录 `local-plugins/dsh-custom-css/`
- 本轮主题：修复「通用」设置中「用户 CSS」摘要按钮的鼠标悬停反馈
- 记录日期：2026-10-29
- Harness 版本：`0.2.1-rc.3`
- 结论：**可行**。按钮的几何、文字与焦点环原本已对齐字体行；唯一偏离的是 `:hover` 使用了不透明的表面色令牌，改用与上下两行一致的悬停令牌即可。

---

## 1. 目的与范围

「用户 CSS」行由本插件注册在 `settings.general.item` 槽位（`id: 'custom-css'`，`order: 11.5`）。行右侧的摘要按钮是一个展开/收起控件：折叠时显示「未注入 / 已注入」与下箭头，展开时显示上箭头。

用户报告：**该按钮在鼠标扫过时的响应效果不正确**，与上方「字体」行（`dsh-font-settings` 注册）和下方「工作步骤展示」行（`ui-chat` 原生注册）不一致。

本轮只修正悬停反馈，不改按钮的尺寸、间距、文案、展开行为与可访问性属性，也不改动用户 CSS 的注入链路。

## 2. 可行性（证据）

在本机运行中的 `0.2.1-rc.3` 发行包中核对了两条参考行与当前实现，三处按钮的结构几乎相同，差别只在 `:hover` 的取值。

### 2.1 上方参考：字体行

`local-plugins/dsh-font-settings/client.js` 的 `.dsf-picker`：

```css
.dsf-picker{…background:var(--dsw-alias-bg-module-platform);…}
.dsf-picker:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dsf-picker:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
```

### 2.2 下方参考：工作步骤展示行（原生）

发行包 `dsh/node_modules/@deepseek-ai/dsh-client-ui-chat/lib/client.js` 中：

- `TranscriptViewRow` 注册 `settings.general.item`，`id: 'transcript-view'`，`order: 12`；
- 它复用的 `PreferenceRow` 使用 CSS module 类 `e8IdOq_selector`：

```css
.e8IdOq_selector{…background:var(--dsw-alias-bg-module-platform);height:36px;…}
.e8IdOq_selector:hover{background:var(--dsw-alias-interactive-bg-hover)}
.e8IdOq_chevron{flex:none}
```

### 2.3 当前实现（异常处）

`dsh-custom-css/client.js` 的 `.dcc-picker`：

```css
.dcc-picker{…background:var(--dsw-alias-bg-module-platform);…}
.dcc-picker:hover{background:var(--dsw-alias-bg-layer-2)}   /* ← 与两条参考行不同 */
```

### 2.4 两个令牌的语义与取值

`@deepseek-ai/dsh-client-ui-theme` 的调色板（发行包 `lib/client.js`）中：

| 令牌 | 语义 | 浅色 | 深色 |
| --- | --- | --- | --- |
| `--dsw-alias-interactive-bg-hover` | 交互控件的悬停底色 | `#2631480f`（半透明） | `#ffffff14`（半透明） |
| `--dsw-alias-bg-layer-2` | 二级嵌套**表面**底色 | `--dsw-static-neutral-bluish-00`（不透明） | `--dsw-static-neutral-bluish-850`（不透明） |
| `--dsw-alias-bg-module-platform` | 控件静止态底色 | `…bluish-60` | `…bluish-800` |

**证据结论**：DSH 用 `interactive-bg-hover` 这一枚专用令牌表达「鼠标悬停在可交互控件上」，它是叠加在静止底色之上的半透明色；`bg-layer-2` 是页面分层布局用的不透明表面色，不是交互状态色。把后者用于 `:hover`，视觉上不是一个轻微的悬停提示，而是一整块表面色替换。

### 2.5 DSH 版本

本轮安装的 Harness 为 `0.2.1-rc.3`（`dsh/package.json` 与 `@deepseek-ai/dsh` 均为该版本），较本插件上一份 FEASIBILITY 记录的 `0.2.0-rc.2` 已更新。插件的 `peerDependencies: "^0.2.0-rc.2"` 仍覆盖该版本（`>=0.2.0-rc.2 <0.3.0`），实际运行中槽位与配置表单均正常。

## 3. 核心进路

**选定方案**：把 `.dcc-picker:hover` 的背景改为 `var(--dsw-alias-interactive-bg-hover)`，与字体行、工作步骤展示行完全一致：

```css
.dcc-picker:hover{background:var(--dsw-alias-interactive-bg-hover)}
```

关键接入点只有 `client.js` 顶部内联的 `CSS` 常量。按钮的 DOM、类名、事件与其余规则保持不变，因此不涉及槽位契约，也不影响展开/保存逻辑。

备选方案对比：

| 方案 | 结果 | 结论 |
| --- | --- | --- |
| **改用 `interactive-bg-hover`** | 与上下两行一致；浅深色下都是克制的半透明提亮/压暗 | **采用** |
| 保留 `bg-layer-2` | 悬停时整块变为不透明表面色，浅色下发白、深色下发黑，与邻近控件割裂 | 拒绝 |
| 改用 `interactive-bg-hover-solid` | 不透明悬停色，来自另一套控件语境；仍与两条参考行不同 | 拒绝 |
| 自造 `color-mix()` 或写死颜色 | 绕开主题令牌，深浅色需要各自维护 | 拒绝 |
| 给按钮加 transition | 两条参考行都没有过渡；会变成第三种手感 | 不采用 |

## 4. 问题与解决办法

### 症状

鼠标移入「用户 CSS」的摘要按钮时，按钮底色出现一块明显、突兀的整块色；与上方字体行、下方工作步骤展示行的轻微悬停反馈不一致。

### 根因

CSS 规则把**表面层令牌** `--dsw-alias-bg-layer-2` 当成了**交互态令牌**使用。静止态背景是 `--dsw-alias-bg-module-platform`，悬停态却跳到另一套不透明的表面色，这个跳变与 DSH 设计系统表达 hover 的方式不同。

### 修法

只替换这一条规则的背景令牌：

```diff
- '.dcc-picker:hover{background:var(--dsw-alias-bg-layer-2)}',
+ '.dcc-picker:hover{background:var(--dsw-alias-interactive-bg-hover)}',
```

### 注意事项

- 交互状态（hover / active / selected）应使用 `interactive-*` 语义令牌；`bg-layer-*` 只描述表面层级，不描述状态。
- 本轮不调整 `.dcc-chevron` 的颜色：字体行用 `label-tertiary`，原生行继承 `label-primary`，当前实现用 `label-secondary`，三者分属不同控件语境，没有一致的目标可对齐，且用户反馈只涉及悬停。
- 字体行与原生行都没有悬停过渡；本轮同样不加，保持三者手感一致。

## 5. 实施与验证

### 变更清单

| 文件 | 变更 |
| --- | --- |
| `client.js` | `.dcc-picker:hover` 背景令牌改为 `--dsw-alias-interactive-bg-hover` |
| `package.json` | 版本 `1.4.0` → `1.4.1`（行为/外观修正） |
| `README.md` | 更新「最后实质性修改于Harness版本」与运行期版本契约 |
| `FEASIBILITY@0.2.1-rc.3.md` | 本文件 |

### 验证记录

- `npm run build`：依赖物化 + 不变量检查通过（含 `client.js` / `index.js` 的 `node --check` 与 Host 半全新进程导入）。
- `cordis_inspect_query`（Client `Slots`）：`settings.general.item` 的 `custom-css` 占据 `order: 11.5`、`active: true`，位于 `font`（11.25）与 `transcript-view`（12）之间，注册关系未受改动影响。
- 视觉核验边界：本会话无浏览器控制或截图能力，无法代替用户观察真实悬停效果；静态层面已确认新规则与两条参考行逐字一致，仍需在页面刷新/热重载后由用户目视确认浅色与深色主题。

## 6. 参考坐标

| 对象 | 路径 / 标识 |
| --- | --- |
| 本插件按钮样式 | `local-plugins/dsh-custom-css/client.js`（`CSS` 常量、`.dcc-picker`） |
| 字体行参考实现 | `local-plugins/dsh-font-settings/client.js`（`.dsf-picker`） |
| 原生参考实现 | `app.asar` → `dsh/node_modules/@deepseek-ai/dsh-client-ui-chat/lib/client.js`（`PreferenceRow`、`e8IdOq_selector`、`TranscriptViewRow`） |
| 主题令牌定义 | `app.asar` → `dsh/node_modules/@deepseek-ai/dsh-client-ui-theme/lib/client.js` |
| 槽位观测 | `cordis_inspect_query` → Client `Slots.listSubTree`，`settings.general.item` |
