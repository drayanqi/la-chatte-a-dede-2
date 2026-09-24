/**
 * ScriptingGuide data (story 8.4) — the in-app version of docs/scripting.md.
 *
 * Assets are the REAL generated GIFs and the field SVG from the docs
 * pipeline (Epic 8): one source of truth, bundled by Vite, fetched by the
 * browser only when the guide actually renders them.
 */
import fieldSvg from '../../docs/scripting/img/field-coordinates.svg';
import moveTowardGif from '../../docs/scripting/img/move-toward.gif';
import dribbleGif from '../../docs/scripting/img/dribble.gif';
import shootGif from '../../docs/scripting/img/shoot.gif';
import stopGif from '../../docs/scripting/img/stop.gif';
import versusGif from '../../docs/scripting/img/versus.gif';

export interface GuideCodeBlock {
  label?: string;
  body: string;
}

export interface GuideFact {
  term: string;
  description: string;
}

export interface GuideTopic {
  id: string;
  /** Rail label */
  label: string;
  title: string;
  /** Code chip under the title */
  signature?: string;
  gif?: string;
  gifAlt?: string;
  paragraphs: string[];
  warning?: string;
  code?: GuideCodeBlock[];
  facts?: GuideFact[];
}

export const GUIDE_TOPICS: GuideTopic[] = [
  {
    id: 'terrain',
    label: 'Le terrain',
    title: 'Le terrain',
    gif: fieldSvg,
    gifAlt: 'Coordonnées du terrain : x de 0 à 100, y de 0 à 50',
    paragraphs: [
      "x va de 0 (but home) à 100 (but away), y va de 0 (haut) à 50 (bas). Les buts sont sur les lignes x = 0 et x = 100, leur bouche couvre y = 15 à 35.",
      "Repères utiles : un joueur court à 0.3535 unités/tick (~21/s), un porteur à 0.8× cette vitesse, une frappe pleine puissance part à 1.76/tick avec une friction de 0.9583/tick. Un joueur prend (ou tacle) le ballon à moins de 2.0 unités de lui.",
    ],
  },
  {
    id: 'move-toward',
    label: 'moveToward',
    title: 'moveToward — courir',
    signature: 'me.moveToward(x, y)',
    gif: moveTowardGif,
    gifAlt: 'Le joueur traverse le terrain, le ballon ne bouge pas',
    paragraphs: [
      "Te déplace vers la cible à pleine vitesse. L'action ne touche JAMAIS au ballon : il reste où il est.",
      "Dans la démo : le joueur traverse tout le terrain pendant que le ballon, posé ailleurs, ne bouge pas d'un pixel.",
    ],
    warning:
      'Si tu possèdes le ballon, moveToward le RELÂCHE là où tu te trouves. Courir ≠ porter.',
    code: [
      {
        body: `function update() {
  const { me } = game;
  me.moveToward(70, 25); // court à droite — le ballon n'est pas concerné
}`,
      },
    ],
  },
  {
    id: 'dribble',
    label: 'dribble',
    title: 'dribble — porter le ballon',
    signature: 'me.dribble(x, y)',
    gif: dribbleGif,
    gifAlt: 'Le porteur slalome entre trois waypoints, ballon au pied',
    paragraphs: [
      "La SEULE façon d'emmener le ballon quelque part. Tu avances à vitesse de porteur (0.8×) et le ballon reste collé à tes pieds. Il faut posséder le ballon.",
      "La démo slalome entre trois waypoints — le zigzag est produit par le moteur, pas dessiné à la main.",
    ],
    warning:
      "Sans le ballon, l'appel est ignoré (DRIBBLE_NO_BALL) et ne consomme PAS ton action du tick.",
    code: [
      {
        body: `const waypoints = [
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
}`,
      },
    ],
  },
  {
    id: 'shoot',
    label: 'shoot',
    title: 'shoot — frapper',
    signature: 'me.shoot(x, y, power)',
    gif: shootGif,
    gifAlt: 'Frappe pleine puissance au corner, le gardien figé est battu',
    paragraphs: [
      "Libère le ballon vers (x, y) à vitesse power × 1.76 par tick. power est borné à 0.1 – 1.0 (une valeur non finie devient 1.0).",
      "Loi du moteur : une frappe cadrée est un TIR, une frappe non cadrée est une PASSE — il n'existe pas d'action « passe » séparée. Dans la démo, le gardien se centre puis se fige : le corner le bat quand même.",
    ],
    warning:
      'Sans le ballon, la frappe est ignorée (SHOOT_NO_BALL) et ne consomme PAS ton action du tick.',
    code: [
      {
        body: `function update() {
  const { me } = game;
  if (game.me.hasBall && game.me.position.x < 65) {
    me.dribble(65, 25);       // on approche au pied
  } else if (game.me.hasBall) {
    me.shoot(100, 32, 1.0);   // pleine puissance au corner
  } else {
    me.stop();
  }
}`,
      },
    ],
  },
  {
    id: 'stop',
    label: 'stop',
    title: 'stop — se parquer',
    signature: 'me.stop()',
    gif: stopGif,
    gifAlt: 'Le coureur se fige en pleine poursuite, le ballon roule devant lui',
    paragraphs: [
      "Te fige sur place. Le reste du monde continue de bouger : dans la démo, le chasseur s'arrête net et le ballon roule sans lui.",
    ],
    code: [
      {
        body: `let ticks = 0;

function update() {
  const { me } = game;
  if (ticks++ < 40) {
    me.moveToward(game.ball.position.x, game.ball.position.y); // poursuite
  } else {
    me.stop(); // parking — le ballon continue
  }
}`,
      },
    ],
  },
  {
    id: 'versus',
    label: 'versus',
    title: 'moveToward vs dribble',
    gif: versusGif,
    gifAlt: 'Course vers le ballon : le coureur le touche en premier, le dribbleur le lui prend et le porte',
    paragraphs: [
      "Deux joueurs, la même ligne de départ, un ballon libre. Le coureur l'atteint en premier… et ne peut pas l'emmener. Le dribbleur le tacle et repart avec.",
      "La loi complète du moteur : toucher le ballon donne la possession (rayon 2.0), mais seule l'action dribble le porte. Un moveToward d'un porteur le relâche — le ballon « saute » et redevient libre.",
    ],
    code: [
      {
        label: 'Le coureur (challenger)',
        body: `function update() {
  const { me } = game;
  if (game.ball.owner === null && !game.me.hasBall) {
    me.moveToward(game.ball.position.x, game.ball.position.y);
  } else {
    me.stop();
  }
}`,
      },
      {
        label: 'Le dribbleur (opponent)',
        body: `function update() {
  const { me } = game;
  if (game.me.hasBall) {
    me.dribble(70, 25); // on l'emmène
  } else {
    me.moveToward(game.ball.position.x, game.ball.position.y);
  }
}`,
      },
    ],
  },
  {
    id: 'lire',
    label: 'Lire le jeu',
    title: 'Lire le jeu — objet game',
    paragraphs: [
      "À chaque tick, le sandbox réassigne l'objet game (variable globale) : ton joueur, le ballon, les autres et le terrain. Tout est en lecture seule — seuls les appels d'action sur me agissent. Tes fonctions utilitaires lisent game directement, sans paramètre.",
    ],
    facts: [
      { term: 'me.position', description: '{ x, y } — x 0–100, y 0–50' },
      { term: 'me.hasBall', description: 'booléen : possession réelle' },
      { term: 'me.slot / me.team', description: '1–5 et "home" / "away" (le moteur dit challenger / opponent)' },
      { term: 'me.isClosestToBall()', description: 'FONCTION — l\'appeler avec des parenthèses ; le plus proche de ton équipe, départage au slot' },
      { term: 'ball.position / ball.velocity', description: 'positions et vitesse en unités/tick' },
      { term: 'ball.owner', description: '"home-3" / "away-1" ou null si le ballon est libre' },
      { term: 'teammates / opponents', description: 'les autres joueurs, même forme que me, sans méthodes d\'action' },
      { term: 'field', description: 'width 100, height 50, goals, zones (homeBox, awayBox, center)' },
      { term: 'Une action par tick', description: 'la PREMIÈRE seule s\'applique ; les suivantes → warning MULTIPLE_ACTIONS' },
      { term: 'console.log/warn/error', description: 'capturés dans les logs du replay (100/tick, 500 caractères)' },
    ],
  },
];
