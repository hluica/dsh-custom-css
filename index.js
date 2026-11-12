/**
 * Host half of the custom-CSS bundle.
 *
 * It owns one user-settings namespace (`dsh-custom-css`, the Loader entry id)
 * carrying the user's CSS fragment. All presentation and the actual stylesheet
 * injection live in the Client half: the fragment is appended to `document.head`
 * from the browser, which is the only way to land *after* the shipped
 * stylesheets and therefore win the cascade on equal specificity.
 *
 * The Host half deliberately performs no CSS validation: the fragment's shape is
 * unbounded, and the external-resource gate belongs where the stylesheet is
 * applied (see `client.js`). It also contributes no `webserver/index-inject`
 * row, so nothing is rendered into the served HTML for this plugin.
 */
import z from '@deepseek-ai/schemastery';

/** Settings namespace owned by this plugin; equals this bundle's Loader entry id. */
const SETTINGS_NAMESPACE = 'dsh-custom-css';

/**
 * Field carrying the user's CSS fragment.
 *
 * Stored as a plain string: CSS has no bounded grammar worth encoding in a
 * schema pattern, and a pattern would reject valid input. `.volatile()` makes
 * the field live, so an accepted write reaches the running plugin without a
 * Host restart and without touching the profile patch's other entries.
 */
const CSS_FIELD = 'css';

/** Live custom-CSS preferences stored in the Host user-settings document. */
const Config = z.object({
  [CSS_FIELD]: z.string().default('').volatile(),
});

/**
 * Register the settings ownership this plugin presents. The row itself is the
 * Client half's; this call keeps the entry in the settings document so its
 * value has one durable home.
 * @param ctx - Host plugin context.
 */
function apply(ctx) {
  ctx.inject(['settings'], (child) => {
    child.effect(() => child.settings.configure({ auto: false }, ctx.fiber));
  });
}

export { CSS_FIELD, Config, SETTINGS_NAMESPACE, apply };
