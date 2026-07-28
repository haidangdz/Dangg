# Hải Đăng Profile Studio

A customizable neon-noir bio profile with durable view counting, media uploads,
music playlists, editable link cards, and a protected owner dashboard.

## Routes

- `/` — public profile
- `/admin` — owner-only customization studio

The public profile stores settings and view totals in D1. Uploaded avatars,
backgrounds, videos, and audio are stored in R2. The first authenticated user
who opens the private deployment's admin page becomes the owner.

## Local development

```bash
pnpm install
pnpm dev
```

Generate a migration after changing `db/schema.ts`:

```bash
pnpm db:generate
```
