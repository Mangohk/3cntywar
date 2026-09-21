# 3cntywar

Prototype of a Clash Royale–like skirmish game themed around the Romance of the Three Kingdoms (三国演义).

## Page
https://mangohk.github.io/3cntywar/

## Play

Open locally with any static server (ES modules require HTTP):

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

Or open via any Live Server / `npx serve`.

**Controls:** select a card in the hand, then click/tap your half of a lane to deploy. Esc cancels selection.

The UI is locked to the viewport (`100dvh`) and scales the board to fit phones (including short iPhone SE heights) without page scrolling.

## Docs

- [DESIGN.md](./DESIGN.md) — v0.1 design document

## Status

v0.1 playable vertical slice: offline Player vs Computer, 2 lanes, Qi resource, fixed 8-card deck, basic AI.
