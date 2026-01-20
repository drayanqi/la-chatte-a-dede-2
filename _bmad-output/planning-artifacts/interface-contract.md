# Contrat d'Interface - Lachatadede

> **Document sacré** - Les deux architectes (Game & Software) respectent ce contrat comme loi fondamentale.
>
> **Date de création** : 2026-01-18
> **Auteurs** : Cloud Dragonborn (Game Architect) + Winston (Software Architect)
> **Statut** : DRAFT - En attente validation Pelo

---

## 1. Vue d'Ensemble

### 1.1 Description du Projet

**Lachatadede** est un éditeur tactique 2D permettant de :
- Visualiser un terrain avec des joueurs (5v5)
- Assigner des scripts IA aux joueurs via drag & drop
- Simuler les tactiques et rejouer frame-by-frame
- Éditer les scripts IA avec Monaco/VSCode
- Debugger le comportement des scripts

### 1.2 Répartition des Responsabilités

| Domaine | Architecte | Responsabilité |
|---------|------------|----------------|
| **Web Shell** | Winston (BMM) | React, Monaco, Debugger UI, State Management, Routing |
| **Canvas/Game** | Cloud Dragonborn (BMGD) | PixiJS, Terrain, Joueurs, Simulation, Replay |

### 1.3 Ratio de Complexité

- **40% Web Application** (Monaco, Debugger, UI shell, navigation)
- **60% Game Engine** (Canvas, simulation, replay, scripts IA)

---

## 2. Stack Technologique

### 2.1 Décisions Communes

```yaml
language: TypeScript (strict mode)
framework: React 18+
state_management: Zustand
build_tool: Vite
package_manager: pnpm
```

### 2.2 Domaine Web (Winston)

```yaml
editor: Monaco Editor (@monaco-editor/react)
styling: Tailwind CSS ou CSS Modules
layout: CSS Grid pour panels redimensionnables
icons: Lucide React
```

### 2.3 Domaine Canvas (Cloud Dragonborn)

```yaml
renderer: PixiJS 8.x
viewport: @pixi/viewport (zoom/pan)
animations: GSAP ou PixiJS ticker
hit_detection: Native PixiJS interactive
```

---

## 3. Architecture des Composants

### 3.1 Structure des Panels

```
┌─────────────────────────────────────────────────────────────────┐
│                         App Shell                                │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                      Header / Toolbar                        ││
│  └─────────────────────────────────────────────────────────────┘│
│  ┌───────────────┬─────────────────────┬───────────────────────┐│
│  │               │                     │                       ││
│  │  Scripts      │   Tactics Canvas    │   Debugger            ││
│  │  Panel        │   (PixiJS)          │   Panel               ││
│  │               │                     │                       ││
│  │  - Script     │   - Terrain         │   - Frame controls    ││
│  │    list       │   - Joueurs (10)    │   - Variable watch    ││
│  │  - Monaco     │   - Ballon          │   - Call stack        ││
│  │    editor     │   - Animations      │   - Breakpoints       ││
│  │               │                     │                       ││
│  └───────────────┴─────────────────────┴───────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    Timeline / Playback                       ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Pattern d'Encapsulation Canvas

Le Canvas PixiJS est encapsulé dans un composant React "wrapper" :

```tsx
// src/components/canvas/TacticsCanvas.tsx
// PROPRIÉTAIRE: Game Architect (Cloud Dragonborn)

interface TacticsCanvasProps {
  // Callbacks vers le monde React
  onPlayerSelected: (event: PlayerSelectedEvent) => void;
  onScriptDropped: (event: ScriptDroppedEvent) => void;
  onFrameChanged: (event: FrameChangedEvent) => void;
  onSimulationComplete: (event: SimulationCompleteEvent) => void;

  // Ref pour commandes impératives
  canvasRef: React.RefObject<TacticsCanvasHandle>;
}

interface TacticsCanvasHandle {
  // Méthodes appelables depuis React
  loadTactic: (tactic: TacticData) => void;
  assignScript: (playerId: string, scriptId: string) => void;
  runSimulation: () => Promise<SimulationResult>;
  seekFrame: (frameIndex: number) => void;
  play: () => void;
  pause: () => void;
  step: (direction: 'forward' | 'backward') => void;
}
```

---

## 4. Contrat d'Interface : Events

### 4.1 Canvas → Web (Events Sortants)

```typescript
// src/types/canvas-events.ts
// PROPRIÉTAIRE CONJOINT: Les deux architectes

export interface PlayerSelectedEvent {
  type: 'PLAYER_SELECTED';
  payload: {
    playerId: string;
    teamId: 'home' | 'away';
    position: { x: number; y: number };
    currentScriptId: string | null;
  };
}

export interface ScriptDroppedEvent {
  type: 'SCRIPT_DROPPED';
  payload: {
    playerId: string;
    scriptId: string;
    dropPosition: { x: number; y: number };
  };
}

export interface FrameChangedEvent {
  type: 'FRAME_CHANGED';
  payload: {
    currentFrame: number;
    totalFrames: number;
    timestamp: number;
    playerStates: PlayerFrameState[];
  };
}

export interface SimulationCompleteEvent {
  type: 'SIMULATION_COMPLETE';
  payload: {
    success: boolean;
    totalFrames: number;
    duration: number;
    errors: SimulationError[];
  };
}
```

### 4.2 Web → Canvas (Commandes Entrantes)

```typescript
// src/types/canvas-commands.ts
// PROPRIÉTAIRE CONJOINT: Les deux architectes

export interface LoadTacticCommand {
  type: 'LOAD_TACTIC';
  payload: TacticData;
}

export interface AssignScriptCommand {
  type: 'ASSIGN_SCRIPT';
  payload: {
    playerId: string;
    scriptId: string;
  };
}

export interface PlaybackCommand {
  type: 'PLAYBACK';
  payload: {
    action: 'play' | 'pause' | 'step_forward' | 'step_backward' | 'seek';
    frameIndex?: number;
  };
}

export interface RunSimulationCommand {
  type: 'RUN_SIMULATION';
  payload: {
    tacticId: string;
    options?: SimulationOptions;
  };
}
```

---

## 5. Contrat d'Interface : Data Types

### 5.1 Types Partagés

```typescript
// src/types/shared.ts
// PROPRIÉTAIRE CONJOINT: Les deux architectes

export interface Player {
  id: string;
  name: string;
  teamId: 'home' | 'away';
  number: number;
  position: Position;
  assignedScriptId: string | null;
}

export interface Position {
  x: number;  // 0-100 (pourcentage du terrain)
  y: number;  // 0-100 (pourcentage du terrain)
}

export interface Script {
  id: string;
  name: string;
  code: string;
  language: 'javascript' | 'typescript';
  lastModified: Date;
}

export interface TacticData {
  id: string;
  name: string;
  players: Player[];
  ball: Position;
  scripts: Record<string, Script>;
}

export interface PlayerFrameState {
  playerId: string;
  position: Position;
  velocity: { vx: number; vy: number };
  state: 'idle' | 'moving' | 'action';
  debugInfo?: Record<string, unknown>;
}

export interface SimulationResult {
  frames: PlayerFrameState[][];
  duration: number;
  errors: SimulationError[];
}

export interface SimulationError {
  frame: number;
  playerId: string;
  scriptId: string;
  message: string;
  stack?: string;
}
```

---

## 6. State Management

### 6.1 Stores Zustand

```typescript
// PROPRIÉTAIRE: Winston (Software Architect)

// Store pour l'éditeur Monaco
interface EditorStore {
  activeScriptId: string | null;
  scripts: Map<string, Script>;
  openScript: (id: string) => void;
  updateScript: (id: string, code: string) => void;
  saveScript: (id: string) => Promise<void>;
}

// Store pour le debugger
interface DebuggerStore {
  isDebugging: boolean;
  currentFrame: number;
  breakpoints: Breakpoint[];
  watchedVariables: WatchedVariable[];
  callStack: CallStackFrame[];
  toggleBreakpoint: (scriptId: string, line: number) => void;
  stepFrame: (direction: 'forward' | 'backward') => void;
}

// Store pour le canvas (état observable côté React)
interface CanvasStore {
  isPlaying: boolean;
  currentFrame: number;
  totalFrames: number;
  selectedPlayerId: string | null;
  tacticLoaded: boolean;
  setSelectedPlayer: (id: string | null) => void;
  updatePlaybackState: (playing: boolean, frame: number) => void;
}
```

### 6.2 Flux de Données

```
┌─────────────────────────────────────────────────────────────┐
│                        User Action                           │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                     React Component                          │
│  (Scripts Panel, Debugger Panel, Timeline)                   │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                     Zustand Store                            │
│  (editorStore, debuggerStore, canvasStore)                   │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              Canvas Handle (Imperative API)                  │
│  canvasRef.current.assignScript(playerId, scriptId)          │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    PixiJS Canvas                             │
│  (Game World - isolated from React render cycle)             │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   Event Callback                             │
│  onPlayerSelected, onFrameChanged, etc.                      │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                     Zustand Store                            │
│  (state update triggers React re-render)                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Drag & Drop : Pont React ↔ Pixi

### 7.1 Implémentation

```typescript
// PROPRIÉTAIRE: Sally (UX) + Cloud Dragonborn (Canvas)

// Côté React (ScriptsPanel.tsx)
const handleDragStart = (e: DragEvent, script: Script) => {
  e.dataTransfer.setData('application/json', JSON.stringify({
    type: 'script',
    scriptId: script.id,
  }));
  e.dataTransfer.effectAllowed = 'copy';
};

// Côté React (TacticsCanvas wrapper)
const handleDrop = (e: DragEvent) => {
  e.preventDefault();
  const data = JSON.parse(e.dataTransfer.getData('application/json'));

  if (data.type === 'script') {
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Demander à Pixi quel joueur est sous ces coordonnées
    const playerId = canvasRef.current.hitTestPlayer(x, y);

    if (playerId) {
      canvasRef.current.assignScript(playerId, data.scriptId);
    }
  }
};

// Côté Pixi (TacticsCanvasHandle)
hitTestPlayer(screenX: number, screenY: number): string | null {
  const worldPos = this.viewport.toWorld(screenX, screenY);

  for (const player of this.players) {
    if (player.containsPoint(worldPos)) {
      return player.id;
    }
  }
  return null;
}
```

---

## 8. Contraintes de Performance

### 8.1 Canvas (Cloud Dragonborn)

| Métrique | Cible | Critique |
|----------|-------|----------|
| FPS Render | 60 fps | < 30 fps |
| Frame seek latency | < 16ms | > 50ms |
| Memory (10 players) | < 50MB | > 100MB |
| Simulation time (1000 frames) | < 2s | > 5s |

### 8.2 Web (Winston)

| Métrique | Cible | Critique |
|----------|-------|----------|
| Monaco load time | < 1s | > 3s |
| State update latency | < 10ms | > 50ms |
| Bundle size (initial) | < 500KB | > 1MB |

---

## 9. Structure des Fichiers

```
src/
├── components/
│   ├── canvas/                    # PROPRIÉTAIRE: Game Architect
│   │   ├── TacticsCanvas.tsx      # Wrapper React
│   │   ├── engine/                # Logique PixiJS pure
│   │   │   ├── Game.ts
│   │   │   ├── Player.ts
│   │   │   ├── Field.ts
│   │   │   └── Simulation.ts
│   │   └── index.ts
│   │
│   ├── editor/                    # PROPRIÉTAIRE: Software Architect
│   │   ├── MonacoEditor.tsx
│   │   ├── ScriptsPanel.tsx
│   │   └── index.ts
│   │
│   ├── debugger/                  # PROPRIÉTAIRE: Software Architect
│   │   ├── DebuggerPanel.tsx
│   │   ├── FrameControls.tsx
│   │   ├── VariableWatch.tsx
│   │   └── index.ts
│   │
│   └── layout/                    # PROPRIÉTAIRE: Software Architect
│       ├── AppShell.tsx
│       ├── Header.tsx
│       └── Timeline.tsx
│
├── stores/                        # PROPRIÉTAIRE: Software Architect
│   ├── editorStore.ts
│   ├── debuggerStore.ts
│   └── canvasStore.ts
│
├── types/                         # PROPRIÉTAIRE CONJOINT
│   ├── shared.ts                  # Types partagés
│   ├── canvas-events.ts           # Events Canvas → Web
│   └── canvas-commands.ts         # Commands Web → Canvas
│
└── hooks/                         # PROPRIÉTAIRE: Software Architect
    ├── useCanvas.ts
    ├── useDebugger.ts
    └── useScripts.ts
```

---

## 10. Règles de Collaboration

### 10.1 Modification des Interfaces

1. **Toute modification** aux fichiers dans `src/types/` requiert l'accord des deux architectes
2. Créer une issue/PR avec le tag `[INTERFACE-CHANGE]`
3. Les deux parties valident avant merge

### 10.2 Points de Synchronisation

- **Hebdomadaire** : Review des interfaces
- **À chaque milestone** : Validation intégration Canvas ↔ Web
- **En cas de blocage** : Party Mode pour résolution collaborative

### 10.3 Résolution des Conflits

1. Le domaine propriétaire a le dernier mot sur son territoire
2. Les interfaces partagées requièrent consensus
3. En cas d'impasse : escalade à Pelo pour décision finale

---

## 11. Prochaines Étapes

- [ ] **Pelo** : Valider ce contrat
- [ ] **Winston** : Créer le projet React + structure de base
- [ ] **Cloud Dragonborn** : Créer le prototype Canvas PixiJS
- [ ] **Intégration** : Premier test drag & drop script → joueur

---

## Signatures

| Agent | Validation |
|-------|------------|
| 🏛️ Cloud Dragonborn (Game Architect) | ✅ Approuvé |
| 🏗️ Winston (Software Architect) | ✅ Approuvé |
| 🎨 Sally (UX Designer) | ✅ Approuvé (section Drag & Drop) |
| 👤 Pelo (Product Owner) | ✅ Validé (2026-01-18) |

