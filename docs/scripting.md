# Scripting Reference — Actions & Game Context

Every player runs one AI script. The engine calls your `update()` function **60 times per second** (one *tick*); each call you may perform **at most one action**. The game state is available as the **global `game`** — no parameter, no JSDoc — and helper functions can read it directly. The legacy `update(game)` parameter style still works. This page is the hands-on guide: what each action does on the pitch, what your script can read, and the warnings you can trigger.

> The full contractual spec lives in [`script-ia-api.md`](../_bmad-output/planning-artifacts/script-ia-api.md) (sandboxing limits, error types, payload shapes). This page shows the behavior.

**Every animation below is real.** Each GIF was produced by running the actual deterministic engine on a minimal situation, then rendering the result with the actual match canvas. Nothing is hand-drawn. See [Regenerating](#regenerating).

---

## The field (coordinates)

![Field coordinates](scripting/img/field-coordinates.svg)

| Thing | Value |
|---|---|
| Width (x) | `0 → 100`, left to right |
| Height (y) | `0 → 50`, **top to bottom** (y grows downward) |
| Goals | On `x = 0` (home) and `x = 100` (away); mouth spans `y = 15 → 35` |
| Zones | `homeBox` = x 0–16, `awayBox` = x 84–100 (both y 15–35); center = `(50, 25)` |

Speeds worth knowing: a player moves **0.3535 units/tick** (~21 units/s); a carrier moves at **0.8×** that; a full-power ball flies at **1.76 units/tick** and decays with friction **0.9583/tick**. A player takes (or tackles) the ball within **2.0 units** of it.

---

## The actions

Only `me` has action methods. Per tick, the **first** action wins; later calls are warned and ignored.

### `me.moveToward(x, y)` — run somewhere

Moves you toward the target at full speed. **It never touches the ball** — and if you currently own the ball, it **releases it where you stand**.

![moveToward — the runner crosses the pitch, the ball never moves](scripting/img/move-toward.gif)

```js
function update() {
  const { me } = game;
  me.moveToward(70, 25); // run to the right — the ball is not involved
}
```

> **The law:** touching the ball gains possession, but possession is not carrying. If you own the ball and call `moveToward`, you drop it.

### `me.dribble(x, y)` — carry the ball

The only way to take the ball somewhere. You move at carrier speed (0.8×) and the ball stays glued to your feet. Requires possession.

![dribble — the carrier zigzags through three waypoints](scripting/img/dribble.gif)

```js
const waypoints = [
  { x: 45, y: 15 },
  { x: 55, y: 35 },
  { x: 65, y: 15 },
];
let next = 0;

function update() {
  const { me } = game;
  const target = waypoints[next];
  if (next < waypoints.length - 1) {
    const dx = target.x - game.me.position.x;
    const dy = target.y - game.me.position.y;
    if (Math.hypot(dx, dy) < 1.5) next++;
  }
  me.dribble(waypoints[next].x, waypoints[next].y);
}
```

### `me.shoot(x, y, power)` — kick the ball

Releases the ball toward `(x, y)` at `power × 1.76` units/tick. `power` is clamped to **0.1 – 1.0** (a non-finite value becomes `1.0`). By the engine's scoring law, an on-target kick is a **TIR** (shot) and an off-target kick is a **PASSE** (pass) — there is no separate pass action.

![shoot — full power into the corner, the frozen keeper is beaten](scripting/img/shoot.gif)

```js
function update() {
  const { me } = game;
  if (game.me.hasBall && game.me.position.x < 65) {
    me.dribble(65, 25);       // carry toward the edge of the box
  } else if (game.me.hasBall) {
    me.shoot(100, 32, 1.0);   // full power into the corner
  } else {
    me.stop();
  }
}
```

*(In the demo, the keeper's script centers on his line, then freezes — the corner still beats him.)*

### `me.stop()` — park

Halts you where you stand. The rest of the world keeps moving.

![stop — the runner parks mid-chase, the ball rolls on without him](scripting/img/stop.gif)

```js
let ticks = 0;

function update() {
  const { me } = game;
  if (ticks++ < 40) {
    me.moveToward(game.ball.position.x, game.ball.position.y); // chase
  } else {
    me.stop(); // park — the ball keeps rolling
  }
}
```

### `moveToward` vs `dribble` — the race that explains it all

Two players, the same starting line, one free ball. The mover reaches it first — and cannot take it anywhere. The dribbler tackles him and carries it off.

![versus — the mover touches the ball first, the dribbler carries it away](scripting/img/versus.gif)

Mover's script (challenger):

```js
function update() {
  const { me } = game;
  if (game.ball.owner === null && !game.me.hasBall) {
    me.moveToward(game.ball.position.x, game.ball.position.y); // race to the ball
  } else {
    me.stop();
  }
}
```

Dribbler's script (opponent):

```js
function update() {
  const { me } = game;
  if (game.me.hasBall) {
    me.dribble(70, 25); // carry it away
  } else {
    me.moveToward(game.ball.position.x, game.ball.position.y);
  }
}
```

---

## Reading the game

The `game` object, rebound by the sandbox to the current tick's snapshot before every `update()` call (helpers read it too):

```ts
interface Game {
  me: Player;           // this player — the ONLY one with action methods
  ball: Ball;
  teammates: Player[];  // without you
  opponents: Player[];
  field: Field;
}
```

### `me` (and every player in `teammates` / `opponents`)

| Member | Type | Notes |
|---|---|---|
| `position` | `{ x, y }` | x 0–100, y 0–50 |
| `hasBall` | `boolean` | possession truth |
| `slot` | `1 – 5` | jersey number |
| `team` | `'home' \| 'away'` | script names; the engine calls them `challenger` / `opponent` |
| `isClosestToBall()` | **function** | call it with parentheses — closest **of your own team**, ties broken by lower slot |
| `moveToward(x, y)` | action | `me` only; `moveTo` is a compatibility alias |
| `dribble(x, y)` | action | `me` only |
| `shoot(x, y, power)` | action | `me` only |
| `stop()` | action | `me` only |

### `game.ball`

| Member | Type | Notes |
|---|---|---|
| `position` | `{ x, y }` | |
| `velocity` | `{ vx, vy }` | units per tick |
| `owner` | `string \| null` | `"home-3"` / `"away-1"` style id, or `null` when free |

### `game.field`

`width: 100`, `height: 50`, `goals` (`home` at `x: 0`, `away` at `x: 100`, both `y: 25`, `width: 20`), `zones` (`homeBox`, `awayBox`, `center` — see the diagram above).

---

## Tick rules & warnings

| Rule | Behavior |
|---|---|
| One action per tick | Only the **first** recorded action applies; later calls log a `MULTIPLE_ACTIONS` warning |
| `dribble` / `shoot` without the ball | Warning (`DRIBBLE_NO_BALL` / `SHOOT_NO_BALL`), the call is ignored — and it does **not** consume the tick's action budget |
| `power` out of range | Clamped to 0.1–1.0; a non-finite value becomes 1.0 |
| `console.log/warn/error` | Captured as `CONSOLE` logs in the replay (max 100 entries/tick, messages truncated at 500 chars) |
| Missing `update` | The script errors with *"missing update function"* |
| `kick` / `kickBall` | Deliberately **not** provided — an aimed kick IS `shoot` (on-target = tir, off-target = passe) |

---

## Regenerating

The assets on this page are generated tooling, not art:

```bash
npm run docs:scripting
```

- `lachatadede-engine` simulates the five situations (deterministic, seed 42) and writes `scripting/frames/*.json` — byte-identical on every run; treat them as golden fixtures: if a physics change makes a regenerated frame file differ, the docs must be re-reviewed.
- Playwright drives the real `TacticsCanvas` in a headless browser and assembles `scripting/img/*.gif`.
- `field-coordinates.svg` is generated from the engine's real `FIELD_DATA` constants.
