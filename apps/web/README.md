# CRM Web App

Next.js frontend for the AI-native CRM.

## Favicon & App Icons

- **favicon.svg** – Lives in `public/favicon.svg`. Icon mark only (no text), optimized for 32×32. Serves as the browser tab icon.
- **Regenerate PNGs** – Run `pnpm --filter @crm/web generate:icons` to generate:
  - `icon-192.png`, `icon-512.png` (manifest/PWA)
  - `apple-touch-icon.png` (180×180, home screen)
  - `favicon-32.png` (32×32)
- **favicon.ico** – For legacy browsers, create manually from `favicon-32.png` (e.g. via [favicon.io](https://favicon.io/favicon-converter/)) and place in `public/`.
- **theme-color** – Uses `NEXT_PUBLIC_ACCENT_1` when set as hex (e.g. `#2563eb`); otherwise defaults to `#2563eb`. Controls browser chrome and PWA theme.

## Branding & Theming

The app supports lightweight branding via environment variables. Set these in `.env.local` (or your deployment environment) to customize the look without changing layout or adding heavy theming libraries.

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_ACCENT_1` | Primary accent color (buttons, links, nav highlight). Hex or space-separated RGB. | `#2563eb` or `37 99 235` |
| `NEXT_PUBLIC_ACCENT_2` | Secondary accent color (AI badges, secondary accents). Hex or space-separated RGB. | `#7c3aed` or `124 58 237` |
| `NEXT_PUBLIC_LOGO_URL` | Logo image URL for the top-left header. Falls back to "CRM" text if unset. | `/logo.svg` or `https://example.com/logo.png` |

### Example `.env.local`

```env
# Accent colors (hex format)
NEXT_PUBLIC_ACCENT_1=#2563eb
NEXT_PUBLIC_ACCENT_2=#7c3aed

# Logo (relative path or full URL)
NEXT_PUBLIC_LOGO_URL=/logo.svg
```

### Where Colors Are Applied

- **Accent 1**: Primary buttons, links, active nav item highlight, focus rings
- **Accent 2**: AI badges (AI Summary, AI Email Draft, Next Best Actions), secondary accent elements

If variables are missing, sensible defaults are used (blue and purple).
