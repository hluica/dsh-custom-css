/**
 * Client half of the custom-CSS bundle.
 *
 * Registers one row in the General settings section — directly after the font
 * rows and before the transcript-view row — that edits the user's CSS fragment
 * in a textarea and applies it on demand.
 *
 * The fragment reaches the document through one `<style>` element appended to
 * `document.head` at module-materialization time. That position is the whole
 * point: the shipped stylesheets already occupy `head`, so only a sheet appended
 * after them can win the cascade at equal specificity. The Host cannot produce
 * this position — `renderIndexInjections` splices every `head` row immediately
 * after the opening `<head>` tag, ahead of those stylesheets — which is why the
 * injection lives here. Appending in the factory body (rather than in `apply`)
 * matches every shipped client bundle and gets the sheet into the document
 * before React paints.
 *
 * Only local files may be referenced. Before a fragment is written or applied it
 * is scanned, and any external reference blocks it with a per-line report.
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-custom-css',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    // The shell exposes the design system's icon set as a platform seed module,
    // so this row draws the same chevrons as every shipped settings control.
    const {
      IconChevronDownOutlineRegular,
      IconChevronUpOutlineRegular,
    } = require('@deepseek-ai/dsh-client-ui-primitives');

    /** Settings namespace owned by the Host half; equals the Loader entry id. */
    const SETTINGS_NAMESPACE = 'dsh-custom-css';
    /** Dictionary namespace carrying this plugin's copy. */
    const DICT_NAMESPACE = 'settings.customCss';
    /** Field inside the settings namespace holding the fragment. */
    const CSS_FIELD = 'css';
    /**
     * Row position: after the font rows (font-size 11, font-sans 11.1,
     * font-mono 11.2) and before the transcript-view row (12).
     */
    const ROW_ORDER = 11.5;
    /** Most blocked references listed in the report; the rest are counted. */
    const MAX_REPORTED = 5;

    /**
     * URI schemes that address something outside the application's own files.
     * A relative or root-absolute path is the only accepted reference shape.
     */
    const EXTERNAL_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

    /** Row and editor styles; only `--dsw-alias-*` and `--dsw-radius-*` carry colour and shape. */
    const CSS = [
      '.dcc-entry{border-bottom:.5px solid var(--dsw-alias-border-l2);flex-direction:column;display:flex}',
      '.dcc-entry>.dcc-row{border-bottom:none}',
      '.dcc-row{border-bottom:.5px solid var(--dsw-alias-border-l2);align-items:center;gap:8px;padding:16px 0;display:flex}',
      '.dcc-rowText{flex-direction:column;flex:1;gap:4px;min-width:0;padding-right:48px;display:flex}',
      '.dcc-title{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:400;line-height:22px}',
      '.dcc-desc{color:var(--dsw-alias-label-tertiary);font-size:12px;font-weight:400;line-height:18px}',
      '.dcc-control{align-items:center;gap:8px;display:inline-flex;flex:0 0 auto}',
      '.dcc-picker{border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-module-platform);border:none;cursor:pointer;align-items:center;gap:8px;height:36px;max-width:280px;padding:0 12px;display:inline-flex;color:var(--dsw-alias-label-primary);font-size:14px;line-height:22px;font-family:var(--dsw-font-family)}',
      '.dcc-picker:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.dcc-picker:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color);outline-offset:2px}',
      '.dcc-value{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dcc-chevron{flex:0 0 auto;color:var(--dsw-alias-label-secondary)}',
      '.dcc-panel{flex-direction:column;gap:12px;padding:0 0 16px;display:flex}',
      '.dcc-textarea{width:100%;box-sizing:border-box;min-height:180px;max-height:420px;resize:vertical;border-radius:var(--dsw-radius-md);border:.5px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-family:var(--ds-font-family-code);font-size:12px;line-height:18px;padding:10px 12px;tab-size:2}',
      '.dcc-textarea:focus{outline:none;border-color:var(--dsw-alias-brand-primary)}',
      '.dcc-actions{align-items:center;gap:8px;display:flex;flex-wrap:wrap}',
      '.dcc-button{border-radius:var(--dsw-radius-sm);border:.5px solid var(--dsw-alias-border-l1);background:transparent;color:var(--dsw-alias-label-primary);cursor:pointer;height:32px;padding:0 14px;font-family:var(--dsw-font-family);font-size:13px;line-height:20px}',
      '.dcc-button:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2)}',
      '.dcc-button:disabled{opacity:.5;cursor:default}',
      '.dcc-button:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color);outline-offset:2px}',
      '.dcc-buttonPrimary{border-color:transparent;background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground)}',
      '.dcc-buttonPrimary:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover)}',
      '.dcc-hint{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}',
      '.dcc-status{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}',
      '.dcc-statusDirty{color:var(--dsw-alias-brand-primary)}',
      '.dcc-statusError{color:var(--dsw-alias-state-error-primary)}',
      '.dcc-warning{border-radius:var(--dsw-radius-md);border:.5px solid var(--dsw-alias-state-error-primary);background:var(--dsw-alias-bg-layer-2);flex-direction:column;gap:6px;padding:10px 12px;display:flex}',
      '.dcc-warningTitle{color:var(--dsw-alias-state-error-primary);font-size:13px;font-weight:500;line-height:20px}',
      '.dcc-warningBody{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;white-space:pre-wrap}',
    ].join('');

    /**
     * The stylesheet this package owns. Appended once at materialization and
     * rewritten in place afterwards, so applying a new fragment never reflows
     * the document twice or races the shipped sheets.
     */
    const styleTag =
      typeof document === 'undefined' ? null : document.createElement('style');
    if (styleTag !== null) {
      // Pre-tag both attributes the module loader books styles by, so the tag is
      // never caught by its catch-all claim of untagged `<style>` elements.
      styleTag.dataset.plugin = '@local/dsh-custom-css';
      styleTag.dataset.pluginCss = '@local/dsh-custom-css/user.css';
      document.head.appendChild(styleTag);
    }

    /**
     * Blank out comment bodies while preserving every newline and character
     * offset, so a reported line number still points at the original line and a
     * commented-out reference is never mistaken for a live one.
     * @param text - CSS source.
     * @returns the source with comment interiors replaced by spaces.
     */
    function stripComments(text) {
      return text.replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '));
    }

    /** @param index - offset into the source. @returns its 1-based line number. */
    function lineAt(text, index) {
      let line = 1;
      for (let i = 0; i < index && i < text.length; i += 1) {
        if (text.charCodeAt(i) === 10) line += 1;
      }
      return line;
    }

    /**
     * Whether one referenced target leaves the application's own files.
     *
     * A scheme (`http:`, `https:`, `data:`, `file:`, `blob:`, `ftp:`, …) or a
     * protocol-relative `//host` is external. Relative and root-absolute paths
     * are local and accepted.
     * @param target - the raw reference text.
     * @returns true when the reference must be blocked.
     */
    function isExternal(target) {
      const value = target.trim();
      if (value === '') return false;
      if (value.startsWith('//')) return true;
      return EXTERNAL_SCHEME.test(value);
    }

    /** Build one report entry with a short display form of its target. */
    function report(kind, line, target) {
      const short = target.trim().replace(/\s+/g, ' ');
      return { kind, line, target: short.length > 80 ? short.slice(0, 77) + '…' : short };
    }

    /**
     * Scan a fragment for references that leave the machine.
     *
     * `@import` is detected in both its quoted-string and bare-`url()` forms, and
     * `url()` anywhere else in the sheet is checked the same way. Because the
     * loader's `@import` handling would fetch a remote sheet eagerly, blocking it
     * matters as much as blocking an image reference.
     *
     * An `@import url(...)` is matched by both patterns; the `url()` pass skips
     * any occurrence already covered by an `@import` span so one reference is
     * reported once, as an import.
     * @param text - the CSS fragment as authored.
     * @returns the blocked references, in source order.
     */
    function findExternalRefs(text) {
      const source = typeof text === 'string' ? text : '';
      if (source === '') return [];
      const code = stripComments(source);
      const found = [];
      const claimed = [];

      const importPattern = /@import\s+(?:url\(\s*(?:"([^"]*)"|'([^']*)'|([^)"'\s][^)]*?))\s*\)|"([^"]*)"|'([^']*)')/gi;
      let match;
      while ((match = importPattern.exec(code)) !== null) {
        // Claim the whole at-rule, so its own `url(` is not reported a second time.
        claimed.push([match.index, match.index + match[0].length]);
        const target = match[1] || match[2] || match[3] || match[4] || match[5] || '';
        if (!isExternal(target)) continue;
        found.push(report('import', lineAt(code, match.index), target));
      }

      const urlPattern = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)"']*?))\s*\)/gi;
      while ((match = urlPattern.exec(code)) !== null) {
        const at = match.index;
        if (claimed.some(([from, to]) => at >= from && at < to)) continue;
        const target = match[1] !== undefined ? match[1]
          : match[2] !== undefined ? match[2]
            : match[3] || '';
        if (!isExternal(target)) continue;
        found.push(report('url', lineAt(code, at), target));
      }

      found.sort((left, right) => left.line - right.line);
      return found;
    }

    /** A minimal external store so the row and the stylesheet share one live state. */
    function createStore(initial) {
      let value = initial;
      const listeners = new Set();
      return {
        get: () => value,
        update(patch) {
          value = { ...value, ...patch };
          for (const listener of listeners) listener();
        },
        subscribe(listener) {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
      };
    }

    /** Re-render one component whenever the shared store changes. */
    function useStore(store) {
      return React.useSyncExternalStore(store.subscribe, store.get, store.get);
    }

    /** Re-render when the active locale changes, so bound copy follows it. */
    function useLocaleRevision(ctx) {
      const [, bump] = React.useReducer((n) => n + 1, 0);
      React.useEffect(() => ctx.locale.subscribe(bump), [ctx]);
    }

    /**
     * The user-CSS row: a collapsed summary that expands into a textarea and its
     * save controls.
     * @param ctx - client cordis context.
     * @param deps - shared plugin state and the write path.
     * @returns the row component.
     */
    function createRow(ctx, deps) {
      return function CustomCssRow() {
        const state = useStore(deps.store);
        useLocaleRevision(ctx);
        const t = ctx.locale.bind(DICT_NAMESPACE);

        const [open, setOpen] = React.useState(false);
        const [draft, setDraft] = React.useState(null);
        const [busy, setBusy] = React.useState(false);

        const saved = state.css || '';
        // The textarea edits a draft; null means "mirror the saved value", which
        // is also how an accepted write and an external profile edit both land.
        const text = draft === null ? saved : draft;
        const dirty = draft !== null && draft !== saved;
        const refs = findExternalRefs(text);
        const blocked = refs.length > 0;
        // Kept separate from `blocked`: this answers "is the *saved* fragment
        // being withheld", which stays true while the user edits a clean draft.
        const savedBlocked = findExternalRefs(saved).length > 0;

        // Saving drops the draft either way: an accepted write republishes the
        // saved value through the form subscription, and a rejected one falls
        // back to the durable value, so the row never shows a stale draft.
        const onSave = () => {
          if (!dirty || busy || blocked) return;
          setBusy(true);
          Promise.resolve(deps.save(draft))
            .catch(() => false)
            .then(() => {
              setDraft(null);
              setBusy(false);
            });
        };

        const summary = saved.trim() === ''
          ? t('summary.notInjected')
          : t('summary.injected');

        // A blocked *draft* is an error the user must act on; a blocked *saved*
        // fragment is a notice, because the draft may already be the clean fix.
        const status = blocked
          ? { className: 'dcc-status dcc-statusError', text: t('editor.blockedStatus') }
          : savedBlocked
            ? { className: 'dcc-status dcc-statusError', text: t('editor.blockedStoredStatus') }
            : dirty
              ? { className: 'dcc-status dcc-statusDirty', text: t('editor.dirty') }
              : { className: 'dcc-status', text: t('editor.idle') };

        return h(
          'div',
          { className: 'dcc-entry' },
          h(
            'div',
            { className: 'dcc-row' },
            h(
              'div',
              { className: 'dcc-rowText' },
              h('div', { className: 'dcc-title' }, t('row.title')),
              h('div', { className: 'dcc-desc' }, t('row.description')),
            ),
            h(
              'div',
              { className: 'dcc-control' },
              h(
                'button',
                {
                  type: 'button',
                  className: 'dcc-picker',
                  'aria-expanded': open ? 'true' : 'false',
                  'aria-label': t(open ? 'action.collapse' : 'action.expand'),
                  title: summary,
                  onClick: () => setOpen((value) => !value),
                },
                h('span', { className: 'dcc-value' }, summary),
                h(open ? IconChevronUpOutlineRegular : IconChevronDownOutlineRegular, {
                  className: 'dcc-chevron',
                  size: 14,
                }),
              ),
            ),
          ),
          open
            ? h(
                'div',
                { className: 'dcc-panel' },
                savedBlocked && !blocked
                  ? h(
                      'div',
                      { className: 'dcc-warning' },
                      h('div', { className: 'dcc-warningTitle' }, t('blocked.title')),
                      h('div', { className: 'dcc-warningBody' }, t('blocked.stored')),
                    )
                  : null,
                blocked
                  ? h(
                      'div',
                      { className: 'dcc-warning' },
                      h('div', { className: 'dcc-warningTitle' }, t('blocked.title')),
                      h(
                        'div',
                        { className: 'dcc-warningBody' },
                        t('blocked.body') + '\n'
                          + refs.slice(0, MAX_REPORTED).map((entry) => t(
                            entry.kind === 'import' ? 'blocked.import' : 'blocked.url',
                            { line: String(entry.line), target: entry.target },
                          )).join('\n')
                          + (refs.length > MAX_REPORTED
                            ? '\n' + t('blocked.more', { n: String(refs.length - MAX_REPORTED) })
                            : ''),
                      ),
                    )
                  : null,
                h('textarea', {
                  className: 'dcc-textarea',
                  'aria-label': t('editor.label'),
                  placeholder: t('editor.placeholder'),
                  spellCheck: false,
                  value: text,
                  onChange: (event) => setDraft(event.target.value),
                }),
                h(
                  'div',
                  { className: 'dcc-actions' },
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'dcc-button dcc-buttonPrimary',
                      disabled: busy || !dirty || blocked,
                      onClick: onSave,
                    },
                    busy ? t('editor.saving') : t('editor.save'),
                  ),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'dcc-button',
                      disabled: busy || !dirty,
                      onClick: () => setDraft(null),
                    },
                    t('editor.revert'),
                  ),
                  h('span', { className: status.className }, status.text),
                ),
                h(
                  'div',
                  { className: 'dcc-hint' },
                  t('editor.hint'),
                  state.writeFailed ? ' ' + t('write.failed') : '',
                ),
                h('div', { className: 'dcc-hint' }, t('editor.tokenHint')),
                h('div', { className: 'dcc-hint' }, t('editor.inspectHint')),
              )
            : null,
        );
      };
    }

    /**
     * Client plugin body.
     * @param ctx - client cordis context.
     */
    function apply(ctx) {
      if (styleTag !== null) {
        ctx.effect(() => () => styleTag.remove(), 'custom-css: stylesheet cleanup');
        // Keep the user sheet LAST in `head`, after every theme sheet.
        //
        // `@deepseek-ai/dsh-client-ui-theme` appends its palette at apply() time and
        // re-renders it when the theme changes. Re-appending the same node moves it
        // to the end of `head`, so the user's fragment is always the last sheet the
        // engine sees: it wins the cascade against equal-specificity theme rules,
        // and it never ends up *before* a theme sheet rewritten later. Custom
        // properties are resolved per element at computed-value time, so this is
        // about cascade order, not about whether `var()` can see the tokens.
        ctx.effect(() => {
          const reappend = () => {
            if (styleTag.parentNode !== null) document.head.appendChild(styleTag);
          };
          reappend();
          ctx.on('theme/change', reappend);
        }, 'custom-css: keep the sheet after the theme sheets');
      }
      ctx.effect(() => {
        const tag = document.createElement('style');
        tag.dataset.plugin = '@local/dsh-custom-css';
        tag.textContent = CSS;
        document.head.appendChild(tag);
        return () => {
          tag.remove();
        };
      }, 'custom-css: row styles');

      ctx.effect(() => ctx.locale.register(DICT_NAMESPACE, { zh, en }), 'custom-css: dictionaries');

      const form = ctx.configForms.get(SETTINGS_NAMESPACE);

      /** Read the saved fragment out of the settings form. */
      const readSaved = () => {
        try {
          const snapshot = form.getSnapshot();
          const value = snapshot !== undefined && snapshot !== null
            && typeof snapshot.value === 'object' && snapshot.value !== null
            ? snapshot.value
            : {};
          return typeof value[CSS_FIELD] === 'string' ? value[CSS_FIELD] : '';
        } catch (error) {
          return '';
        }
      };

      const store = createStore({ css: readSaved(), writeFailed: false });

      /**
       * Push the saved fragment into the document. A fragment naming an external
       * resource is withheld rather than applied: the gate is enforced on the way
       * in, so a value that reached the profile patch by hand is caught too.
       * @param css - the fragment as stored.
       */
      const publish = (css) => {
        const blocked = findExternalRefs(css).length > 0;
        if (styleTag !== null) styleTag.textContent = blocked ? '' : css;
      };

      ctx.effect(() => {
        const sync = () => {
          const next = readSaved();
          if (next === store.get().css) return;
          publish(next);
          store.update({ css: next });
        };
        const dispose = form.subscribe(sync);
        const initial = readSaved();
        publish(initial);
        store.update({ css: initial });
        return dispose;
      }, 'custom-css: apply the accepted fragment');

      const deps = {
        store,
        save: (css) => Promise.resolve(form.set(CSS_FIELD, css)).then((accepted) => {
          if (accepted === false) {
            const durable = readSaved();
            publish(durable);
            store.update({ css: durable, writeFailed: true });
            return false;
          }
          // The authoritative value arrives through the form subscription; clear
          // the failure flag so a retry starts from a clean notice.
          store.update({ writeFailed: false });
          return true;
        }),
      };

      ctx.slots.inject('settings.general.item', () =>
        ctx.slots.register(
          { name: 'settings.general.item', id: 'custom-css', order: ROW_ORDER },
          createRow(ctx, deps),
        ),
      );
    }

    /** Dictionaries inlined so the bundle needs no locale file at runtime. */
    const zh = {
      'row.title': '用户 CSS',
      'row.description': '自定义界面的外观；保存后立即生效。只允许引用本地文件。',
      'summary.notInjected': '未注入',
      'summary.injected': '已注入',
      'action.expand': '展开用户 CSS 编辑器',
      'action.collapse': '收起用户 CSS 编辑器',
      'editor.label': 'CSS 片段',
      'editor.placeholder': '例如：\n.my-panel {\n  color: var(--dsw-alias-label-primary);\n  background: var(--dsw-alias-bg-layer-2);\n  border: 1px solid var(--dsw-alias-border-l2);\n}\n\n只允许引用本地文件：url(./x.png) 或 url(/abs/x.png)。\n外部链接（http、https、//、data、file 等）会被拦截。',
      'editor.hint': '保存后立即生效，不会校验或格式化 CSS 语法。',
      'editor.tokenHint': '建议用内置颜色变量（如 --dsw-alias-label-primary、--dsw-alias-bg-base、--dsw-alias-border-l2），它们会自动跟随深浅色主题切换。',
      'editor.inspectHint': '想快速查看 DeepSeek Harness 当前使用的界面源代码（含你自己的 CSS），可按 F12 打开 DevTools。',
      'editor.save': '保存并应用',
      'editor.saving': '正在保存…',
      'editor.revert': '放弃修改',
      'editor.idle': '尚无未保存的修改',
      'editor.dirty': '有未保存的修改',
      'editor.blockedStatus': '存在被拦截的引用',
      'editor.blockedStoredStatus': '已保存的 CSS 未生效',
      'blocked.title': '已拦截：用户 CSS 引用了外部资源',
      'blocked.body': '只允许引用本地文件。请移除下列引用后重新保存。当前 CSS 未生效。',
      'blocked.import': '第 {line} 行：@import 引用了外部资源（{target}）',
      'blocked.url': '第 {line} 行：url() 引用了外部资源（{target}）',
      'blocked.more': '另有 {n} 处未列出。',
      'blocked.stored': '已保存的 CSS 含有外部资源引用，因此未生效。请修改后重新保存。',
      'write.failed': '保存失败，已恢复为已保存的内容。',
    };

    const en = {
      'row.title': 'User CSS',
      'row.description': 'Customize how the interface looks; applied as soon as you save. Only local files may be referenced.',
      'summary.notInjected': 'Not injected',
      'summary.injected': 'Injected',
      'action.expand': 'Expand the user CSS editor',
      'action.collapse': 'Collapse the user CSS editor',
      'editor.label': 'CSS fragment',
      'editor.placeholder': 'For example:\n.my-panel {\n  color: var(--dsw-alias-label-primary);\n  background: var(--dsw-alias-bg-layer-2);\n  border: 1px solid var(--dsw-alias-border-l2);\n}\n\nOnly local files may be referenced: url(./x.png) or url(/abs/x.png).\nExternal links (http, https, //, data, file, …) are blocked.',
      'editor.hint': 'Applied as soon as you save. The CSS is neither validated nor formatted.',
      'editor.tokenHint': 'Prefer the built-in colour variables (such as --dsw-alias-label-primary, --dsw-alias-bg-base, --dsw-alias-border-l2); they follow the light/dark theme automatically.',
      'editor.inspectHint': 'To inspect the source the interface is currently using — your own CSS included — press F12 to open DevTools.',
      'editor.save': 'Save and apply',
      'editor.saving': 'Saving…',
      'editor.revert': 'Discard changes',
      'editor.idle': 'No unsaved changes',
      'editor.dirty': 'Unsaved changes',
      'editor.blockedStatus': 'Blocked references present',
      'editor.blockedStoredStatus': 'Saved CSS is not applied',
      'blocked.title': 'Blocked: the user CSS references external resources',
      'blocked.body': 'Only local files may be referenced. Remove the references below and save again. The current CSS is not applied.',
      'blocked.import': 'Line {line}: @import references an external resource ({target})',
      'blocked.url': 'Line {line}: url() references an external resource ({target})',
      'blocked.more': '{n} more not listed.',
      'blocked.stored': 'The saved CSS references external resources, so it is not applied. Edit and save again.',
      'write.failed': 'Saving failed; the last saved content was restored.',
    };

    return {
      // `theme` is declared so the theme service is live before this plugin starts:
      // the user sheet is kept after the theme's palette sheets.
      inject: ['slots', 'locale', 'configForms', 'theme'],
      apply,
    };
  },
});
