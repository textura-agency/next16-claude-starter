# Skin map — what `custom.css` targets in Payload 3.89

Payload's class names are **not a public API**. This is the list to re-check
after an upgrade: open each screen, compare against the intent column.

| Block in `custom.css` | Payload selectors | Intent |
|---|---|---|
| Tier 1 + ramp | `--color-base-0…1000`, `--color-success-*`, `--theme-bg`, `--theme-input-bg`, `--theme-text`, `--theme-border-color`, `--accessibility-outline`, `--font-body`, `--style-radius-s/m/l` | every Payload surface/ink/border follows the site's palette |
| Type | `h1–h4`, `.doc-header__title`, `.render-title`, `.view-description`, `.custom-view-description` | headings by size not weight, navy; descriptions muted |
| Nav | `.nav`, `.nav-group__toggle`, `.nav__link`, `.nav__link.active`, `.nav__link-indicator` | white column, 11px uppercase group labels, hover = colour only, active = navy 500, no indicator bar |
| Settings last | `.nav__wrap > .nav-group:first-child` (order 1), `.nav__controls` (order 2), `.collections__wrap`, `.collections__group:first-child` | collections list before globals — move Settings below the content |
| Buttons | `.btn`, `.btn--style-primary`, `.btn--style-secondary`, `.doc-tab`, `.doc-tab--active` | pill buttons; primary = the site's gradient CTA |
| Dashboard | `.card`, `.card__title`, `.collections__label` | white cards, hairline, no shadow |
| Edit view | `.doc-controls` (sticky bar, translucent ground + blur), `.document-fields__edit`, `.field-label`, `.field-type`, `.field-description`, `.react-select` | one white panel; 13px labels; inputs on `--admin-field` |
| Groups | `.group-field`, `--top-level`, `--within-group`, `--gutter`, `.group-field__title .field-label` | top level: heading + air + hairline; nested: soft panel, small heading, no left rule |
| Arrays / blocks | `.collapsible`, `--style-default`, `__header-wrap`, `__toggle`, `__content`, `.row-label`, `.array-field__title`, `.blocks-field__title` | one rounded frame, `overflow: hidden`, square inner parts; Payload's `--style-default` border re-pointed at `--admin-line` |
| Tabs | `.tabs-field__tabs`, `.tabs-field__tab-button`, `--active`, `.tabs-field__description` | wrapping pill switch, every tab bordered and legible |
| Login | `.template-minimal`, `__wrap` | ground behind, form on a white card, wordmark above |
| Kit components | `.cms-logo*`, `.cms-icon`, `.cms-welcome*`, `.cms-share*`, `.ca-*` (analytics), `.cg-*` (guide) | ours — stable |

Custom views (`/admin/analytics`, `/admin/guide`) render inside
`DefaultTemplate` and use Payload's `gutter--left gutter--right` so they line up
with the native views.

Tour after any change or upgrade, at 1440 and 390 wide: login → dashboard →
a global with nested groups and an array → SEO (tabs) → Media → Analytics → Guide.
