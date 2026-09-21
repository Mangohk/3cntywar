# Clash Royale–style Enhancement Backlog

Manager process for slowly aligning **3cntywar** with Clash Royale behavior.

## Cadence
- Every **12 hours**, present **5 enhancement options**.
- User picks **1**.
- Implementer sub-agent lands the change.
- Tester sub-agent verifies (smoke + focused checks + screenshots when UI).
- If green → ask user to **review / approve / push**.

## Reference
- https://clashroyale.fandom.com/wiki/Cards
- Core CR card dimensions: Elixir Cost, Hitpoints, Damage, Hit Speed, Range, Targets (Ground/Air/Buildings), Count, Transport (Ground/Air), Speed, Deploy Time

## Gap analysis (current prototype vs CR)
Already present (simplified): cost, hp, damage, attack speed, range, sight, move speed, target preference, splash, anti-cavalry trait, troop **count**, 4-card cycle, Qi regen, towers.

Missing / weak vs CR:
1. ~~Troop **Count** (spawn N units per card: Skeletons/Goblin Gang style)~~ — **done** (`CardDef.count`, `spawnCardUnits`)
2. **Deploy time** / wind-up before acting
3. **Targets** flags (air/ground) + flying transport
4. Tower retarget rules closer to CR (lock, switch when closer)
5. **Death damage** / on-death effects
6. Card info panel (tap to inspect stats like CR)
7. Pushback / knockback on heavy hits
8. Building cards (spawner / defensive building)
9. Spells (area damage, freeze, rage)
10. Elixir/Qi leak at cap feedback + precise CR regen timing
11. Mirror / cycle clarity (next card preview)
12. Troop mass / collision stacking in lane

## Round log

### Round 1 — proposed (awaiting choice)
See chat message for the 5 options.

**Chosen: A — Troop Count** (2026-09-21)

**Implemented:** Each card has `count` (≥ 1). `tryDeploy` spends Qi / cycles hand once and calls `spawnCardUnits` to place N units with small lane-clamped offsets near the drop. Baseline: militia 3, crossbow/spearman 2, elites & siege 1.
