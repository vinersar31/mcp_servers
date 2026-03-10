# Meet The Monsters (MCP App)

A small MCP App that lets users browse monsters, view detailed stats, and render a collectible monster card UI.

## Provided tools

- `get-monsters` (App Tool + UI)
  - Returns monster names/IDs and loads the gallery view (`mcp-app.html`).
- `get-monster-stats` (App-only tool)
  - Returns detailed stats + image for one monster (used by the gallery UI).
- `show-monster-card` (App Tool + UI)
  - Returns one monster’s data and renders the card view (`monster-card.html`).
- `get-monster-bio` (standard MCP tool)
  - Returns only the biography text for one monster.

## Provided UI resources

- `ui://meet-the-monsters/mcp-app.html`
- `ui://meet-the-monsters/monster-card.html`

## Quick setup

```bash
npm install
npm run dev
```

## Server endpoint / port

- MCP HTTP endpoint: `http://localhost:3001/mcp`
- Default port: `3001` (override with `PORT`, e.g. `PORT=4000 npm run dev`)

