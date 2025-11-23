README — Futsal AI
Jeu de simulation de futsal 2D contrôlé par des IA JavaScript indépendantes

Version : 1.0 – Document exhaustif

🏆 1. LE JEU : DESCRIPTION COMPLÈTE
🎯 1.1 Objectif général

Futsal AI est un jeu de football en salle (futsal) en 2D (vue du dessus).
Chaque joueur sur le terrain est contrôlé par une IA indépendante définie dans un fichier .js fourni par l’utilisateur.

Le but : programmer les meilleurs comportements pour gagner un match sans intervention humaine en temps réel.

👥 1.2 Les équipes

2 équipes : Équipe A et Équipe B

Chaque équipe est composée de 5 joueurs

Les joueurs sont représentés par de simples cercles portant un numéro 1 → 5

Pas de gardien dédié — tous les joueurs sont équivalents (les IA décident des rôles)

⚽ 1.3 Le terrain

Dimensions type futsal, paramétrables.

Le terrain est entouré de murs :

❌ aucune sortie en touche

❌ aucun arrêt de jeu pour une balle sortie

✔️ le ballon rebondit sur les murs avec restitution (par défaut : 70%)

Zones du terrain :

Surface de jeu rectangulaire

Buts à gauche et à droite (goals définis par coordonnées)

Ligne médiane (option visuelle uniquement)

🎮 1.4 Le gameplay
Actions possibles :

Se déplacer dans n’importe quelle direction

Sprinter (optionnel)

Frapper la balle dans une direction (kick)

Dribbler grâce au système de possession hybride

Caractéristiques :

Pas de hors-jeu

Pas de fautes

Pas de carton

Jeu fluide type HaxBall, mais basé sur une vraie physique 2D.

🧠 1.5 Le contrôle du joueur : uniquement via IA

Le joueur humain ne contrôle rien pendant le match.

Chaque joueur du match (10 au total) est contrôlé par un module IA distinct :

1 fichier .js par joueur (donc 10 fichiers en tout)

Chaque IA expose une seule fonction obligatoire :

function onTick(gameState, dt) {
return { move, sprint, kick };
}


Cette fonction est appelée 30 fois par seconde pour chaque joueur.

⏱️ 1.6 Le déroulement du match

Le match dure 2 × 5 minutes

Chrono affiché

Score affiché

Après un but :

Reset complet des positions des joueurs

Balle replacée au centre

Engagement donné à l’équipe qui n’a PAS marqué

Petite pause (1.5s)

🧪 1.7 Debug & visualisation

Options disponibles :

Debug overlay (hitboxes, vecteurs)

Trace de balle

Numérotation des joueurs

Scoreboard + chrono

📼 1.8 Replays et logs

Le moteur peut :

Enregistrer chaque tick d’IA et chaque action

Exporter le match en JSON

Rejouer un match entièrement en mode Replay

Reproduire exactement un match grâce à un seed déterministe

🔧 2. LES SPECS TECHNIQUES (EXHAUSTIVES)

Cette partie est destinée à un moteur de génération de code (ex. Codex) pour qu'il puisse implémenter le projet entièrement.

📁 2.1 Structure du projet
futsal-ai/
├── index.html
├── package.json
├── serve.js
├── src/
│   ├── main.js
│   ├── config.js
│   ├── game/
│   │   ├── Game.js
│   │   ├── MatchRecorder.js
│   │   ├── ReplayPlayer.js
│   │   └── ConfigManager.js
│   ├── sim/
│   │   ├── PhysicsEngine.js
│   │   ├── Integrator.js
│   │   ├── Entity.js
│   │   ├── Player.js
│   │   └── Ball.js
│   ├── ai/
│   │   ├── AIAdapter.js
│   │   └── AILoader.js
│   ├── ui/
│   │   ├── Renderer.js
│   │   ├── UIControls.js
│   │   └── DebugOverlay.js
│   ├── util/
│   │   ├── Vec2.js
│   │   ├── Random.js
│   │   └── Hash.js
│   └── tests/
│       ├── physics.test.js
│       └── determinism.test.js
└── public/
└── examples/
├── example_ai_simple.js
└── example_ai_goalkeeper.js

⚙️ 2.2 Configuration centrale (config.js)

Le jeu utilise un fichier central de configuration, importable partout.

Exemple :

export const DEFAULT_CONFIG = {
field: { width: 900, height: 600 },
player: {
radius: 14, mass: 10,
maxSpeed: 320,
maxAccel: 1200,
sprintMultiplier: 1.35,
staminaMax: 100
},
ball: {
radius: 7, mass: 1,
friction: 0.995,
rollingResistance: 0.998
},
physics: {
dt: 1/60,
aiTickHz: 30,
collisionRestitution: 0.7,
playerPlayerRestitution: 0.6,
maxSubSteps: 5
},
kick: {
maxPower: 1200,
kickRange: 20,
controlRadius: 18,
controlStrength: 600,
controlTimeoutOnKick: 200
},
game: {
matchTimePerHalf: 300,
postGoalPause: 1.5
}
};


Chaque valeur est modifiable.

🧠 2.3 API IA (INDISPENSABLE)
Fonction attendue

L’IA doit impérativement définir :

function onTick(gameState, dt) { ... }

Input : gameState

Contient :

{
time,
dt,
me: { id, team, number, x, y, vx, vy, stamina },
ball: { x, y, vx, vy, lastTouchPlayerId },
players: [ { id, team, number, x, y, vx, vy, hasBall } ],
field: { width, height, goalLeft, goalRight },
score: { team0, team1 },
configVersion,
matchSeed
}

Output : action
{
move: { x, y },        // vecteur directionnel
sprint: Boolean,       // optionnel
kick: { power, dirX, dirY } | null
}

🧮 2.4 Moteur physique (DÉTAILLÉ)
Principes

Fonctionne en fixed timestep 60Hz

IA appelée à 30Hz

Collisions :

joueur ↔ joueur (cercle/cercle)

joueur ↔ balle (impulsion)

balle ↔ mur (restitution 0.7)

Friction appliquée à chaque tick :
velocity *= friction

Possession hybride

Lorsqu'un joueur est proche de la balle :

Physique + Assistance :

Une force attire légèrement la balle vers un point devant le joueur

Permet un dribble stable mais pas "collant"

Assistance désactivée juste après un tir

Kick

Conditions :

Distance joueur↔ball ≤ kickRange

Impulsion :

ball.velocity += normalize(dir) * power * kick.maxPower

🔁 2.5 Déroulement de la boucle de jeu

Pseudocode :

loop(renderTime) {
accumulate += dtFrame;
while (accumulate >= physics.dt) {

    // On appelle l’IA toutes les 2 frames physiques (60Hz / 30Hz)
    if (stepIndex % 2 === 0) {
      for each player:
        action[player] = IA[player].onTick(gameState, 1/30);
    }

    // Appliquer les actions
    applyActions(action);

    // Physique
    physics.step(1/60);

    accumulate -= physics.dt;
}

renderer.render(interpolation);
}

🧪 2.6 Tests unitaires recommandés

Collision balle–mur

Collision joueur–joueur

Impulsion kick

Possession hybride

Déterminisme (même seed = même sortie)

🖼️ 2.7 UI / Renderer

Canvas 2D

Affiche :

terrain

joueurs (cercles)

numéros

balle

score

chrono

Debug overlay :

vecteurs vitesse

vecteurs move désiré

zones de collision

🧷 2.8 Logging et replays

Format JSON :

{
"metadata": { "matchSeed":123, "configVersion":"v1" },
"actions": [
{ "tick":0, "actions":{"p1":{...},"p2":{...}} }
]
}


Replay = re-simulation des actions enregistrées.

📦 2.9 Serveur local (éviter CORS)

Le projet contient un serveur Node minimal :

node serve.js


ou

npm start

🧱 2.10 Patterns utilisés

Strategy : IA, intégrateurs, rendu

Observer : événements de match

Factory : création d’entités (joueurs, balles)

Command : actions IA → moteur

🎨 2.11 Exemple d’IA simple
function onTick(gameState, dt) {
const me = gameState.me;
const ball = gameState.ball;

const dx = ball.x - me.x;
const dy = ball.y - me.y;
const dist = Math.hypot(dx, dy) || 1;
const move = { x: dx/dist, y: dy/dist };

let kick = null;
if (dist < 22) {
const goalX = me.team === 0 ? gameState.field.width : 0;
const gx = goalX - ball.x;
const gy = (gameState.field.height/2) - ball.y;
const g = Math.hypot(gx, gy) || 1;
kick = { power: 0.9, dirX: gx/g, dirY: gy/g };
}

return { move, sprint: false, kick };
}


## Installation

- Node.js 18+ is recommended. Using very old runtimes (e.g. Node 8) with a recent npm triggers errors such as `Cannot find module 'node:path'` during `npm install`.
- Install dependencies (even though none are declared, this will honor the `engines` warning):

```bash
npm install
```

## Run locally

You can run the zero-dependency static server with:

```bash
node serve.js
```

or using npm:

```bash
npm start
```

Then open: http://localhost:3000

## Notes

- No npm packages are required; `serve.js` uses Node's built-in modules.
- If you want a dev server with auto-reload, install a tool like `live-server`:
  `npm i -g live-server` and then `live-server`.
- Upload example AI files from `public/examples/*.js` via the UI (upload controls provided in final implementation).
# la-chatte-a-dede-2
