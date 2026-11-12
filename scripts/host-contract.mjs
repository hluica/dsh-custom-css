/**
 * Host-half contract probe for the custom-CSS bundle.
 *
 * The Host half owns one settings namespace carrying the user's CSS fragment and
 * registers nothing else — no `webserver/index-inject` row, because the fragment has
 * to land *after* the shipped stylesheets and only the browser can do that. So the
 * things worth asserting are exactly the two names the settings document is keyed
 * by (renaming either orphans what the user saved) and the fact that the fragment
 * survives validation byte for byte, since it is CSS and not a bounded grammar.
 *
 * @module scripts/host-contract
 */
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { runProbe } from './lib/probe-runner.mjs';

/**
 * Assert the Host-half contract.
 * @param context - `{ root, patchId, check }`.
 * @returns `{ identity }` — the settings namespace, compared against the bundle patch id.
 */
export async function probeHost({ root, patchId, check }) {
  const mod = await import(pathToFileURL(join(root, 'index.js')).href);

  check('exports apply()', typeof mod.apply === 'function');
  check('exports Config', typeof mod.Config === 'function');
  check('SETTINGS_NAMESPACE is the Loader entry id', mod.SETTINGS_NAMESPACE === 'dsh-custom-css', `${mod.SETTINGS_NAMESPACE} — the entry id is also the settings-document key, so renaming it orphans every saved fragment`);
  check('CSS_FIELD is the css field', mod.CSS_FIELD === 'css', `${mod.CSS_FIELD} — the field name is the key inside the settings document, so renaming it orphans the saved fragment too`);

  const empty = mod.Config({});
  check('Config materializes the volatile css field', typeof empty?.css?.get === 'function');
  check('css defaults to the empty fragment', empty?.css?.get() === '', JSON.stringify(empty?.css?.get()));
  const fragment = 'body{color:var(--dsw-alias-label-primary)}';
  const filled = mod.Config({ css: fragment });
  check('css round-trips through validation untouched', filled?.css?.get() === fragment, JSON.stringify(filled?.css?.get()));

  const calls = [];
  const fiber = { name: 'fiber' };
  const ctx = {
    fiber,
    inject(dependencies, callback) {
      calls.push(['inject', dependencies]);
      callback({
        effect(callback2) {
          calls.push(['effect']);
          return callback2();
        },
        settings: {
          configure(options, owner) {
            calls.push(['configure', options, owner]);
            return () => {};
          },
        },
      });
    },
  };
  mod.apply(ctx);
  check('apply() injects the settings service', JSON.stringify(calls[0]) === JSON.stringify(['inject', ['settings']]), JSON.stringify(calls[0]));
  check('apply() configures the namespace with auto:false and its own fiber', calls.some((call) => call[0] === 'configure' && call[1].auto === false && call[2] === fiber), JSON.stringify(calls));

  return { identity: mod.SETTINGS_NAMESPACE };
}

runProbe(import.meta.url, probeHost);
