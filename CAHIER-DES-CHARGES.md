# Cahier des charges — Bibliothèque PolyFaceLib

Spécification destinée à Claude Code pour l'implémentation d'une bibliothèque de visualisation **polyédrique** navigable, distribuée sur npm et GitHub.

---

## 1. Vision

Bibliothèque JS/TS fournissant un composant de visualisation où le contenu est organisé sur les faces d'un **polyèdre arbitraire** (cube, tétraèdre, octaèdre, dodécaèdre, icosaèdre, prismes, ou polyèdre custom défini par l'utilisateur). La navigation entre faces s'effectue par interaction avec les arêtes de la face visible (clic, gesture, contrôles), déclenchant une rotation animée du polyèdre.

**Public cible :** développeurs intégrant le composant dans leurs projets web (vanilla, React, Vue, Svelte, etc.).

**Contraintes structurantes :**
- **Moteur 3D propriétaire** : math 3D, projection perspective, animations, navigation et transparence sont **entièrement** calculés par la bibliothèque. Aucune dépendance à Three.js / WebGL / `transform-style: preserve-3d`.
- **Rendu hybride DOM** : la bibliothèque produit une matrice `matrix3d()` par face appliquée à un vrai élément DOM. Scroll natif, tous CSS, interactivité complète.
- **Polyèdre arbitraire** : cube, solides de Platon prédéfinis, prismes paramétriques, ou polyèdre custom défini par vertices + faces.
- Distribution npm en TypeScript vanilla, sans dépendance runtime.
- API agnostique du framework, responsive et tactile par défaut.

---

## 2. Stack technique

| Élément | Choix |
|---|---|
| Langage | TypeScript strict |
| Cible compilation | ES2020 + ESM + CJS + UMD |
| Rendu | DOM + CSS `transform: matrix3d(…)` calculée par le moteur propriétaire |
| Math 3D | Implémentation interne (Vec3, Mat4, Quat, projection perspective) |
| Inputs | Pointer Events API + KeyboardEvent |
| Observabilité | `ResizeObserver` |
| Build | `tsup` (ESM/CJS/d.ts) |
| Tests | `vitest` + `@vitest/browser` |
| Lint/format | `eslint` + `prettier` |
| Docs | `typedoc` + site démo Vite |
| CI | GitHub Actions |
| Dépendances runtime | **Aucune** |

---

## 3. Architecture du package

```
polyfacelib/
├── src/
│   ├── core/
│   │   ├── math/            # vec3, mat4, quat, projection
│   │   ├── projector.ts     # 3D → matrix3d CSS
│   │   ├── animator.ts      # interpolation rotations (slerp)
│   │   └── frame.ts         # boucle rAF
│   ├── polyhedra/
│   │   ├── polyhedron.ts    # type Polyhedron + validation
│   │   ├── adjacency.ts     # calcul du graphe face↔arête↔face
│   │   ├── orientations.ts  # calcul des orientations canoniques
│   │   ├── transitions.ts   # générateur de la table de transitions
│   │   └── presets/
│   │       ├── cube.ts
│   │       ├── tetrahedron.ts
│   │       ├── octahedron.ts
│   │       ├── dodecahedron.ts
│   │       ├── icosahedron.ts
│   │       └── prism.ts     # prisme paramétrique (n côtés)
│   ├── input/
│   │   ├── pointer.ts       # clic + swipe
│   │   ├── keyboard.ts
│   │   ├── controls.ts      # contrôles UI (1 par arête)
│   │   └── zones.ts         # découpage face en N triangles (1/arête) + dead zone
│   ├── render/
│   │   ├── stage.ts         # création DOM (container + N faces)
│   │   ├── clip.ts          # CSS clip-path par forme de face
│   │   └── responsive.ts    # ResizeObserver + breakpoints
│   ├── faces/
│   │   ├── face-content.ts  # API setFace
│   │   ├── text.ts
│   │   ├── image.ts
│   │   ├── html.ts
│   │   └── component.ts
│   ├── transparency/
│   │   └── depth-opacity.ts
│   ├── public-api.ts
│   └── index.ts
├── examples/
├── tests/
├── package.json
├── tsconfig.json
├── README.md
└── LICENSE                  # MIT
```

---

## 4. Modèle de polyèdre

### 4.1 Définition générique

```ts
interface Polyhedron {
  vertices: Vec3[];                    // sommets en coordonnées 3D
  faces: PolyhedronFace[];             // ordre des sommets : sens horaire vu depuis l'extérieur
}

interface PolyhedronFace {
  vertexIndices: number[];             // indices dans `vertices`, ≥ 3
  upHint?: Vec3;                       // direction « haut sémantique » canonique (optionnel)
  id?: string;                         // identifiant utilisateur (sinon : index)
}
```

**Contraintes de validation (à l'init) :**
- Polyèdre **convexe** uniquement en v1 (vérification : tous les sommets du même côté de chaque face). Cas non-convexes → warning + comportement non garanti.
- Chaque arête est partagée par exactement 2 faces (vérification topologique).
- Faces ≥ 3 sommets, planaires (tolérance configurable).

### 4.2 Calculs dérivés (faits une fois à l'init)

Pour chaque face :
- `center` : centroïde (moyenne des sommets).
- `normal` : produit vectoriel des deux premières arêtes, normalisé.
- `edges` : liste des arêtes (paires de sommets consécutifs) avec, pour chacune, l'indice de la face adjacente.
- `canonicalOrientation` : quaternion qui amène cette face face caméra avec son `upHint` aligné sur le haut écran.
- `inscribedRect` : rectangle inscrit le plus grand (utilisé pour positionner du contenu rectangulaire si l'utilisateur le souhaite).

### 4.3 Adjacence

Le graphe d'adjacence `(face, edgeIndex) → (faceAdj, edgeIndexInFaceAdj)` est calculé à l'init via une table de hachage des arêtes (clé : paire de sommets triée).

---

## 5. Polyèdres prédéfinis

| Preset | Faces | Forme face | Symétries |
|---|---|---|---|
| `'cube'` | 6 | carré | 24 orientations |
| `'tetrahedron'` | 4 | triangle équilatéral | 12 |
| `'octahedron'` | 8 | triangle équilatéral | 24 |
| `'dodecahedron'` | 12 | pentagone régulier | 60 |
| `'icosahedron'` | 20 | triangle équilatéral | 60 |
| `'prism'` | n+2 | n-gone (haut/bas) + n rectangles (côtés) | paramétrique |

API factory :

```ts
import { Polyhedra } from 'polyfacelib';

const cube       = Polyhedra.cube();
const tetra      = Polyhedra.tetrahedron();
const dodec      = Polyhedra.dodecahedron();
const hexPrism   = Polyhedra.prism({ sides: 6, height: 1 });

// Custom :
const custom: Polyhedron = {
  vertices: [...],
  faces: [
    { vertexIndices: [0, 1, 2, 3], upHint: [0, 1, 0] },
    ...
  ]
};
```

---

## 6. Moteur de rendu hybride

### 6.1 Pipeline par frame

1. **Mise à jour état** : `Quat.slerp(from, to, easedT)`.
2. **Application** : pour chaque face, transformer ses sommets locaux en coordonnées monde.
3. **Projection perspective propriétaire** : matrice 4×4 finale combinant rotation + translation caméra + perspective. **Calcul interne**, pas de `perspective:` CSS.
4. **Tri profondeur** : tri des faces par z-centroïde, traduit en `z-index` DOM.
5. **Application au DOM** :
   ```ts
   faceEl.style.transform     = `matrix3d(${m.join(',')})`;
   faceEl.style.opacity       = computedOpacity;
   faceEl.style.zIndex        = depthOrder;
   faceEl.style.pointerEvents = isActiveFace ? 'auto' : 'none';
   ```

### 6.2 Conséquences UX

- ✅ Scroll natif `overflow: auto` à l'intérieur de chaque face.
- ✅ Tous CSS applicables, interactivité totale.
- ⚠️ Faces non actives ont `pointer-events: none`.

### 6.3 Math nécessaire

- `Vec3`, `Vec4`, `Mat4`, `Quat` (slerp incluse).
- `Mat4.toCSSMatrix3d(m): string` — sérialisation column-major (norme CSS).

---

## 7. Logique de navigation

### 7.1 Modèle d'état

Le polyèdre a une rotation représentée par un quaternion `currentRotation`. À tout instant, la lib dérive `(face_visible, roll)` du quaternion. Le `roll` est quantifié en N positions où N = nombre d'arêtes de la face (cube : 4 rolls ; triangle : 3 rolls ; pentagone : 5 rolls).

### 7.2 Table de transitions générée dynamiquement

À l'init, un solveur produit la table `(face, roll, edgeClicked) → (faceAdj, rollAdj, quaternionTarget)` à partir du graphe d'adjacence et des orientations canoniques.

**Règle clé invariante :** la face d'arrivée est toujours dans une orientation lisible (`upHint` aligné avec le haut de l'écran). Le quaternion cible est précalculé pour respecter cette règle.

Tailles indicatives : cube 96, tétraèdre 36, octaèdre 72, dodécaèdre 300, icosaèdre 360.

### 7.3 Modes d'interaction

```ts
interaction: {
  edgeClick: boolean,                                        // défaut: true
  swipe: boolean,                                            // défaut: true
  swipeMode: 'edge' | 'twoFingers' | 'always',               // défaut: 'edge'
  controls: 'none' | 'edges' | 'buttons' | 'both',           // défaut selon breakpoint
  keyboard: KeyboardConfig,                                  // voir 7.3.4
}
```

#### 7.3.1 Clic sur arête (généralisé)

La face active est divisée en **N triangles** depuis le centroïde vers chaque arête (N = nombre d'arêtes de la face) :
- Chaque triangle correspond à une arête → navigation vers la face adjacente.
- `centerDeadZone` (défaut 60% de l'inradius) : zone centrale réservée au scroll/interaction du contenu.
- Les zones triangulaires ne couvrent que la couronne périphérique.

#### 7.3.2 Gestures swipe

- `pointerdown` dans la couronne périphérique + mouvement > `swipeThreshold` (défaut 30 px) → **détection de l'arête cible** : on calcule l'angle du vecteur de swipe et on sélectionne l'arête dont la normale 2D projetée est la plus proche de cet angle. Navigation vers cette arête.
- `pointerdown` en zone centrale → scroll natif du contenu, pas d'interception.

Modes `'twoFingers'` et `'always'` comme spécifié précédemment.

#### 7.3.3 Contrôles UI

- `'edges'` : un chevron par arête, positionné à mi-arête, orienté vers l'extérieur. Le nombre s'adapte à la face courante.
- `'buttons'` : panneau de boutons en overlay. Pour les polyèdres complexes, layout adaptatif (boutons disposés en cercle autour d'un point central).
- Personnalisation via classes `.pf-control`, `.pf-control--edge-{i}`.

#### 7.3.4 Clavier

```ts
keyboard: {
  enabled: boolean,
  mode: 'arrows' | 'numeric' | 'tab',  // défaut: 'arrows'
}
```

- `'arrows'` : flèches mappées sur les 4 arêtes les plus proches des directions cardinales (fonctionne nativement pour cube/prismes ; mapping approximatif pour les autres polyèdres).
- `'numeric'` : touches `1`–`N` sélectionnent l'arête `i` (utile pour pentagone, hexagone…).
- `'tab'` : `Tab`/`Shift+Tab` cyclent entre arêtes ; `Enter` valide.

### 7.4 Animation

- Durée par défaut `400ms`, easing `easeInOutCubic`, `Quat.slerp`.
- Inputs ignorés pendant l'animation (ou queueués si `queueInputs: true`).

---

## 8. Faces non rectangulaires : clipping et scroll

### 8.1 Structure DOM par face

```html
<div class="pf-face pf-face--{i}" data-face="{i}" style="clip-path: polygon(...)">
  <div class="pf-face__viewport">
    <div class="pf-face__content">
      <!-- contenu utilisateur -->
    </div>
  </div>
</div>
```

- `.pf-face` : élément transformé, **rectangulaire** = bounding box de la face polygonale, **clippé** par CSS `clip-path: polygon(...)` pour épouser la forme réelle (triangle, pentagone…).
- `.pf-face__viewport` : `width:100%; height:100%; overflow:auto;` — scrolle dans la bounding box.
- `.pf-face__content` : contenu utilisateur, taille libre.

### 8.2 Zone sûre pour le contenu

- Pour les faces non rectangulaires, la lib expose la `inscribedRect` (rectangle inscrit dans le polygone) via une CSS variable `--pf-safe-area`.
- Un opt-in `safeAreaPadding: boolean` (défaut `true`) applique automatiquement un padding qui aligne `.pf-face__content` sur l'inscribed rect, garantissant que le contenu rectangulaire n'est pas tronqué par le clip-path.
- Si `safeAreaPadding: false`, l'utilisateur gère son layout (utile pour des contenus qui épousent volontairement la forme de la face).

### 8.3 Liberté CSS

L'utilisateur peut cibler `.pf-face__content` et utiliser :
- `clip-path` complémentaire si besoin de formes plus complexes.
- CSS variables exposées : `--pf-face-size`, `--pf-face-sides`, `--pf-rotation-progress`, `--pf-current-face`, `--pf-safe-area-{top|right|bottom|left}`.
- N'importe quelle règle CSS (Grid, Flex, sticky dans le viewport scrollable, animations…).

### 8.4 Scroll

- Position de scroll mémorisée par face entre navigations.
- `resetScrollOnNavigate: boolean` (défaut `false`).

---

## 9. Responsive

### 9.1 Adaptation taille

`ResizeObserver` sur le container. Politique de dimensionnement (`sizing`) :
- `'fit'` (défaut) : polyèdre = `min(width, height)` du container.
- `'fill'` : remplit le container.
- `'fixed'` : px fixe.

Recalcul des matrices, du clip-path par face, et des zones de clic à chaque resize.

### 9.2 Breakpoints comportementaux

| Breakpoint | Largeur | Comportements par défaut |
|---|---|---|
| `mobile` | < 640px | `controls: 'edges'`, `swipeMode: 'edge'`, zones tactiles ≥ 44px |
| `tablet` | 640–1024px | `controls: 'edges'`, swipe + clic |
| `desktop` | > 1024px | `controls: 'none'`, swipe + clic + clavier |

**Adaptation pour polyèdres à faces nombreuses :** sur mobile, si le nombre d'arêtes par face × `centerDeadZone` rend les zones tactiles < 44px, la lib :
1. agrandit le polyèdre (`sizing: 'fill'`),
2. à défaut, émet un warning dev,
3. propose à l'utilisateur d'utiliser `keyboard.mode: 'numeric'` ou `controls: 'buttons'` en alternative.

### 9.3 Accessibilité

- `aria-label` localisables sur tous les contrôles.
- Composant focusable (Tab).
- `aria-live="polite"` pour annoncer le changement de face.
- WCAG : zones de clic ≥ 44×44 px sur mobile.
- Respect de `prefers-reduced-motion` (option `prefersReducedMotion: 'auto'`).

---

## 10. Système de transparence graduelle

```ts
interface TransparencyConfig {
  enabled: boolean;
  nearOpacity: number;   // défaut 0.3
  farOpacity: number;    // défaut 0.9
  curve: 'linear' | 'smoothstep' | ((t: number) => number);
  cullBackFaces: boolean;
}
```

Pour chaque face : `t = (depth - minDepth) / (maxDepth - minDepth)`, `opacity = lerp(nearOpacity, farOpacity, curve(t))`. Le calcul est correct pour un nombre arbitraire de faces.

---

## 11. API publique

### 11.1 Création

```ts
import { PolyFaceLib, Polyhedra } from 'polyfacelib';

const view = new PolyFaceLib({
  container: HTMLElement | string,
  polyhedron: Polyhedra.cube(),                // ou autre preset, ou Polyhedron custom
  size: 'fit' | 'fill' | number,
  initialFace: number,                          // index dans polyhedron.faces
  transparency: TransparencyConfig | false,
  animation: { duration?: number; easing?: EasingFn },
  perspective: number,                          // distance focale (défaut 800)
  background: string | null,
  interaction: InteractionConfig,
  breakpoints: BreakpointsConfig,
  resetScrollOnNavigate: boolean,
  prefersReducedMotion: 'auto' | boolean,
  centerDeadZone: number,                       // 0..1 de l'inradius (défaut 0.6)
  swipeThreshold: number,                       // px (défaut 30)
  safeAreaPadding: boolean,                     // défaut true
});
```

### 11.2 Définition du contenu des faces

```ts
view.setFace(0, { type: 'text',  text: 'Hello' });
view.setFace(1, { type: 'image', src: '/img.jpg', fit: 'cover' });
view.setFace(2, { type: 'html',  html: '<h1>Titre</h1>...' });
view.setFace(3, { type: 'html',  element: someElement });
view.setFace(4, {
  type: 'component',
  mount: (faceContentEl) => {
    // monter React/Vue/Svelte/…
    return () => { /* unmount */ };
  },
});
```

### 11.3 Navigation

```ts
view.navigateEdge(edgeIndex: number): Promise<void>;       // navigue par index d'arête de la face active
view.navigateDirection(angle: number): Promise<void>;      // navigue par angle 2D (utile pour swipe)
view.navigate('right' | 'left' | 'up' | 'down'): Promise<void>;  // sucre, mappe vers l'arête la plus proche
view.goToFace(index: number, opts?: { animate?: boolean }): Promise<void>;
view.getCurrentFace(): { index: number; roll: number; rollSteps: number };
view.getFaceCount(): number;
view.scrollFace(face: number, x: number, y: number): void;
view.getFaceScroll(face: number): { x: number; y: number };
```

### 11.4 Événements

```ts
view.on('beforeNavigate', e => { /* e.from, e.to, e.edgeIndex, e.preventDefault() */ });
view.on('afterNavigate',  e => { /* e.from, e.to */ });
view.on('faceClick',      e => { /* e.face, e.position */ });
view.on('faceScroll',     e => { /* e.face, e.x, e.y */ });
view.on('resize',         e => { /* e.width, e.height, e.size */ });
view.on('animationFrame', e => { /* e.progress */ });
```

### 11.5 Cycle de vie

```ts
view.start();
view.stop();
view.resize();
view.destroy();
```

---

## 12. Synchronisation multi-vues

### 12.1 Vue d'ensemble

Plusieurs instances de `PolyFaceLib` peuvent être liées pour propager les actions de navigation et/ou de scroll d'une vue vers les autres. Utile pour :
- Comparaisons côte à côte (avant/après, points de vue multiples).
- Tutoriels où une vue « miroir » illustre les manipulations.
- Tableaux de bord où plusieurs facettes d'une donnée tournent ensemble.

### 12.2 API

```ts
import { PolyFaceLib, sync, Polyhedra } from 'polyfacelib';

const a = new PolyFaceLib({ container: '#a', polyhedron: Polyhedra.cube() });
const b = new PolyFaceLib({ container: '#b', polyhedron: Polyhedra.cube() });

const link = sync([a, b], {
  mode: 'parallel' | 'mirror' | 'opposite' | 'custom',
  master?: PolyFaceLib,         // si défini, propagation unidirectionnelle (défaut : bidirectionnelle)
  syncScroll?: boolean,      // synchronise aussi la position de scroll par face (défaut : false)
  syncAnimation?: boolean,   // anime simultanément (true) ou séquentiellement (false). Défaut : true
  map?: (event, source, targets) => void,  // requis si mode === 'custom'
});

link.pause();    // suspend la synchronisation
link.resume();
link.unsync();   // détruit le lien
```

### 12.3 Modes

- **`'parallel'`** : la cible navigue sur la même arête (par index) que la source. Pré-requis : polyèdres de même type, ou au moins même nombre d'arêtes par face active.
- **`'mirror'`** : navigation miroir selon un axe configurable (`axis: 'horizontal' | 'vertical'`). `right` ↔ `left`, `up` ↔ `down`.
- **`'opposite'`** : la cible navigue vers la face opposée (la face dont la normale pointe à l'opposé de la face de destination de la source). Définition canonique en géométrie convexe.
- **`'custom'`** : la fonction `map` reçoit l'événement source et applique manuellement l'action sur les cibles.

### 12.4 Polyèdres hétérogènes

Si les polyèdres ne sont pas identiques (ex : cube synchronisé avec dodécaèdre), seul le mode `'custom'` est garanti. Les modes `'parallel'`, `'mirror'`, `'opposite'` lèvent une erreur à l'init si les topologies sont incompatibles, avec un message indiquant la table de mapping attendue.

### 12.5 Garanties

- **Pas de feedback infini** : un événement de navigation déclenché par la sync est marqué et ne re-déclenche pas la sync inverse, même en mode bidirectionnel.
- **Cycles** : `sync([a, b, c])` synchronise les trois entre elles ; un changement sur `a` propage à `b` et `c` simultanément (pas en cascade).
- **Animation** : si `syncAnimation: true`, toutes les vues utilisent la même `animation.duration` et démarrent dans la même frame `rAF` ; les visualisations restent en phase.
- **Destruction** : si une vue est `destroy()`, le lien est automatiquement nettoyé.

---

## 13. Persistance d'état

### 13.1 Vue d'ensemble

Sauvegarde et restauration automatique de l'état d'une vue entre rechargements/sessions. État persistable :
- Face active et son roll.
- Position de scroll par face.
- Rotation exacte (optionnel, pour reprise en cours d'animation).

### 13.2 API

```ts
new PolyFaceLib({
  persistence: {
    enabled: boolean,
    storage: 'localStorage' | 'sessionStorage' | StorageAdapter,
    key: string,                                       // clé unique, obligatoire si enabled
    persist: ('face' | 'scroll' | 'rotation')[],       // défaut: ['face', 'scroll']
    debounce: number,                                  // ms, défaut 300
    schemaVersion: number,                             // défaut 1
    migrate?: (old: unknown, oldVersion: number) => PersistedState | null,
    onError?: (error: Error, op: 'read' | 'write' | 'parse') => void,
  }
});
```

### 13.3 Adaptateur de stockage personnalisé

```ts
interface StorageAdapter {
  get(key: string): string | null | Promise<string | null>;
  set(key: string, value: string): void | Promise<void>;
  remove(key: string): void | Promise<void>;
}
```

Permet IndexedDB, backend distant, cookies, ou tout autre support. Les méthodes peuvent être synchrones ou asynchrones — la lib gère les deux.

### 13.4 Méthodes programmatiques

```ts
view.persist();         // force une sauvegarde immédiate (bypass debounce)
view.restore();         // force une restauration depuis storage
view.clearPersisted();  // efface les données sauvegardées
```

### 13.5 Cycle de vie

- **Init** : si `persistence.enabled`, lecture du storage. Donnée trouvée et `schemaVersion` compatible → restauration (face + scroll). Sinon état par défaut. Erreur de parse → `onError` + état par défaut.
- **Runtime** : sur `afterNavigate` et `faceScroll`, écriture debounced (300ms par défaut).
- **`destroy()`** : flush des écritures en attente.

### 13.6 Robustesse

- **Storage indisponible** (mode privé Safari, quota dépassé, opt-out cookies) : `onError` appelé, fallback silencieux en mémoire pour la session courante. La vue reste fonctionnelle.
- **Schéma incompatible** : si `schemaVersion` enregistré ≠ actuel, appel de `migrate()`. Si non fourni ou retourne `null`, données ignorées et état par défaut appliqué.
- **Adaptateur asynchrone** : la lib expose `view.ready: Promise<void>` qui résout après restauration. Pendant l'attente, la vue affiche `initialFace`.
- **Multi-onglets** : par défaut, pas de synchronisation entre onglets. Option future possible via `BroadcastChannel` (hors-scope v1).

### 13.7 Format sérialisé

```ts
interface PersistedState {
  v: number;                                  // schemaVersion
  face?: number;                              // index face active
  roll?: number;                              // roll en steps
  scroll?: Record<number, [number, number]>;  // par index de face : [x, y]
  rotation?: [number, number, number, number]; // quaternion (si 'rotation' dans persist)
  ts: number;                                 // timestamp d'écriture
}
```

---

## 14. Tests

- **Math** : couverture 100% sur vec3/mat4/quat + projection.
- **Polyèdres** : pour chaque preset, vérifier la validité topologique (Euler V−E+F=2), les normales pointent vers l'extérieur, l'adjacence est cohérente.
- **Solveur de transitions** : pour chaque preset, vérifier que toutes les transitions amènent une face dans l'orientation lisible et que la composition de N rotations identiques revient à l'état initial.
- **Renderer** : `matrix3d` cohérente avec un cas de référence indépendant.
- **Inputs** : zones de clic correctement sectorisées pour faces à 3, 4, 5 arêtes.
- **Clipping** : `clip-path` correctement généré pour formes diverses.
- **Responsive** : redimensionnements simulés, breakpoints, fallbacks pour zones < 44px.
- **Polyèdres custom** : validation rejette les non-convexes/non-fermés avec messages clairs.
- **Performance** : ≥ 60 FPS sur dodécaèdre avec contenus DOM riches.

Cible couverture : > 85%.

---

## 15. Documentation et exemples

### `/examples/`
1. `cube-basic.html` — cube 6 textes
2. `tetrahedron.html` — tétraèdre 4 faces
3. `dodecahedron.html` — dodécaèdre 12 faces
4. `prism.html` — prisme hexagonal
5. `custom-polyhedron.html` — polyèdre custom défini par l'utilisateur
6. `gallery.html` — galerie photo (cube)
7. `dashboard.html` — 6 widgets HTML interactifs (cube)
8. `transparency.html` — démo transparence graduelle
9. `long-content.html` — scroll intra-face
10. `mobile-gestures.html` — gestures tactiles
11. `responsive.html` — adaptation laptop/tablet/mobile
12. `react-integration.html` — intégration React via `mount`
13. `synced-views.html` — démo de synchronisation multi-vues (parallel + mirror)
14. `persistence.html` — démo de persistance localStorage + adaptateur IndexedDB

---

## 16. Build et publication

```json
{
  "name": "polyfacelib",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".":            { "import": "./dist/index.js", "require": "./dist/index.cjs", "types": "./dist/index.d.ts" },
    "./styles.css": "./dist/styles.css",
    "./presets":    { "import": "./dist/presets.js", "require": "./dist/presets.cjs", "types": "./dist/presets.d.ts" }
  },
  "files": ["dist"],
  "sideEffects": ["*.css"]
}
```

Sous-export `polyfacelib/presets` permettant de tree-shaker les solides non utilisés.

CI : `ci.yml` (lint + test + build), `release.yml` (npm publish + GitHub Pages).

Licence MIT.

---

## 17. Critères d'acceptation (Definition of Done)

- [ ] Aucune dépendance runtime.
- [ ] Build < 35 KB minifié+gzippé pour le core (presets en chunks séparés tree-shakable).
- [ ] Moteur 3D 100% interne (pas de Three.js, pas de `preserve-3d`, pas de `perspective:` CSS).
- [ ] Validation polyédrique correcte (convexité, fermeture, adjacence).
- [ ] Solveur de transitions générique fonctionnel pour tout polyèdre convexe.
- [ ] Toutes les transitions amènent une face dans l'orientation lisible (testé pour les 5 solides de Platon + 1 custom).
- [ ] Transparence graduelle correcte pour N faces.
- [ ] 4 types de contenu (text, image, html, component) fonctionnent.
- [ ] Scroll natif intra-face opérationnel sans interférence avec navigation.
- [ ] Clip-path correctement généré pour faces non rectangulaires.
- [ ] Position de scroll mémorisée par face.
- [ ] Tous CSS standards applicables au contenu.
- [ ] Navigation : clic sur arête, swipe, contrôles UI, clavier (3 modes) — toutes fonctionnelles.
- [ ] Adaptation correcte mobile/tablet/desktop/ultra-wide, y compris pour polyèdres à faces nombreuses.
- [ ] Respect de `prefers-reduced-motion`.
- [ ] Couverture tests > 85%.
- [ ] Synchronisation multi-vues opérationnelle dans les 4 modes (parallel, mirror, opposite, custom), bidirectionnelle et unidirectionnelle, sans feedback infini.
- [ ] Persistance d'état fonctionnelle : localStorage, sessionStorage et adaptateur custom (testé avec IndexedDB), avec debounce, migration de schéma et fallback en mémoire si storage indisponible.
- [ ] 14 démos HTML autonomes.
- [ ] README, démo en ligne, npm publié, GitHub Pages déployé.

---

## 18. Hors-scope (v1)

- Polyèdres **non convexes** : warning émis, comportement non garanti.
- Wrappers framework officiels (React/Vue) — v0.2.
- Mode WebGL — explicitement exclu.
- Polyèdres dynamiques (faces ajoutées/retirées en runtime) — non prévu.
- Animation de morphing entre polyèdres — non prévu.
- Synchronisation multi-onglets via `BroadcastChannel` — non prévu (l'utilisateur peut le câbler via les événements et `view.persist()`).

---

## 19. Notes pour Claude Code

- **Ordre d'implémentation :** math → définition Polyhedron + validation → adjacence → orientations canoniques → solveur de transitions → projector matrix3d → animator → stage DOM + clip-path → frame loop → input pointer/keyboard/controls → API publique → contenus de face → scroll/CSS → responsive (breakpoints + fallbacks) → transparence → presets (cube d'abord, puis tétraèdre, puis le reste) → synchronisation multi-vues → **persistance d'état** → tests → docs → exemples.
- **TypeScript strict :** `strict: true`, `noUncheckedIndexedAccess: true`, pas d'`any`.
- **Generic-first :** tout le code doit fonctionner pour un polyèdre arbitraire ; le cube est un cas particulier, pas la base.
- **Solveur de transitions :** investir du temps là — c'est la pièce algorithmique centrale. Tests exhaustifs indispensables (vérifier que toute séquence de N navigations identiques sur une face à N arêtes ramène à l'état de départ).
- **JSDoc** sur toute fonction publique.
- **Tree-shaking :** les presets sont des modules indépendants ; importer seulement ce qu'on utilise.
- **Pas de polyfill** : navigateurs modernes (Chrome/Firefox/Safari/Edge des 2 dernières années).
