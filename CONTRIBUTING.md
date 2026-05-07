# Contributing to PolyFaceLib

Thanks for considering a contribution! PolyFaceLib is built around a small set of carefully designed primitives — geometry, a custom 3D engine, and a transition solver — and the goal is to keep the surface area focused while making the internals robust enough for production use. This document explains how to set up the project, write code that fits the codebase, and test contributions to the standard the library expects.

---

## Ways to contribute

- **Bug reports.** Open an issue with a minimal reproduction (CodeSandbox, StackBlitz, or a small repo). Include browser, OS, package version, and the polyhedron config you were using.
- **Feature requests.** Open an issue describing the use case before writing code. The library has a deliberately narrow scope; not every idea will be in scope, and getting alignment early saves everyone time.
- **Documentation.** README typos, API reference clarifications, more or better examples — all welcome.
- **Pull requests.** See the PR process below. For non-trivial work, please open an issue first to discuss the approach.
- **Examples and demos.** New entries under `/examples/` showing real use cases (especially custom polyhedra, framework integrations, or unusual content layouts) are valuable.

---

## Development setup

### Prerequisites

- Node.js ≥ 20
- npm ≥ 10 (we use npm, not yarn or pnpm, to keep CI simple)
- A modern browser for running the test suite (Chromium-based recommended for the browser test runner)

### Initial setup

```bash
git clone https://github.com/Lancrey/polyfacelib.git
cd polyfacelib
npm install
```

### Common commands

```bash
npm run dev          # watch-mode rebuild of /dist (no HTTP server)
npm run examples     # build /dist and serve /examples on http://localhost:5173/
npm run build        # production build (ESM + CJS + d.ts) into /dist
npm run test         # run the full test suite (unit + browser)
npm run test:watch   # watch-mode tests
npm run test:browser # browser-based tests only (renderer + pointer)
npm run lint         # eslint + prettier check
npm run lint:fix     # auto-fix what can be fixed
npm run typecheck    # tsc --noEmit
npm run docs         # generate typedoc API reference into /docs
```

Before opening a PR, run `npm run lint && npm run typecheck && npm run test`. CI runs all three; local pre-flight saves a round trip.

---

## Project layout

```
src/
├── core/         # math, projector, animator, frame loop
├── polyhedra/    # generic Polyhedron type, validation, adjacency, transition solver, presets
├── input/        # pointer, keyboard, controls, click zones
├── render/       # DOM stage, clip-paths, responsive
├── faces/        # face content adapters (text, image, html, component)
├── transparency/ # depth-based opacity
├── public-api.ts # public exports
└── index.ts
```

The boundary that matters most: `core/` and `polyhedra/` know nothing about the DOM. They produce pure data (matrices, transition tables). `render/` and `input/` consume that data and bind it to the browser. Keep this separation when adding code — it's what makes the math testable in isolation.

---

## Coding standards

### TypeScript

- `strict: true`, `noUncheckedIndexedAccess: true`. No `any`. If you genuinely need `unknown`, narrow it explicitly.
- Public functions and classes carry full JSDoc, including `@param`, `@returns`, and at least one `@example` for non-trivial APIs.
- Prefer `readonly` and immutable patterns for math types (`Vec3`, `Mat4`, `Quat`). Mutation is allowed only inside hot loops with a comment explaining why.
- Exported types end in nouns (`PolyhedronFace`, `TransparencyConfig`). Functions are verbs.

### Style

- Prettier handles formatting. Don't argue with it.
- ESLint enforces import ordering, no unused vars, and a few project-specific rules. Fix lint locally rather than disabling rules.
- Two-space indentation. Trailing commas in multi-line literals. Single quotes for strings except inside JSX-like contexts.

### Naming

- File names: `kebab-case.ts`.
- Public exports: `PascalCase` for types/classes, `camelCase` for functions and instances.
- Internal helpers prefixed with `_` are not exported.
- CSS classes use the `pf-` prefix and BEM-ish conventions: `.pf-face`, `.pf-face__viewport`, `.pf-face--active`.

### Dependencies

- **No runtime dependencies.** This is a hard rule. The library ships zero `dependencies` in `package.json`. Dev dependencies are fine within reason.
- Avoid adding bundled polyfills. We target evergreen browsers with native APIs.

---

## Testing

PolyFaceLib aims for >85% line coverage, but raw coverage isn't the point — the point is that the parts that *can* go subtly wrong are exercised by tests that would catch them. Three areas demand particular care.

### 1. Math (`src/core/math/`)

Pure functions, fully unit-tested. We use **property-based testing** via `vitest` + `fast-check` for invariants:

- Quaternion multiplication is associative.
- `Quat.slerp(a, b, 0)` equals `a`; `Quat.slerp(a, b, 1)` equals `b` (within float epsilon).
- A unit quaternion's inverse is its conjugate.
- `Mat4.fromQuaternion(q)` then back to quaternion round-trips.
- Perspective projection of a point at infinity converges to the principal point.

Coverage target on `core/math/`: **100%**.

### 2. Transition solver (`src/polyhedra/transitions.ts`)

This is the algorithmic core of the library, and the hardest thing to get right. The solver takes a polyhedron and produces, for every (face, roll, edge) triple, the target quaternion that rotates the polyhedron so that:

1. The adjacent face becomes front-facing.
2. That face's `upHint` aligns with the screen up axis.

Tests must enforce these invariants for every preset polyhedron and at least one custom non-symmetric one:

**Per-transition invariants:**
- The target quaternion produces a rotation that maps the adjacent face's center to `(0, 0, +1)`.
- The adjacent face's `upHint`, after rotation, has positive Y and zero X (within epsilon).
- The transition is valid (the source and destination faces share the indicated edge).

**Cycle invariants (critical):**
- For any face with N edges, navigating across the same edge index N times in a row returns the polyhedron to the starting orientation. This catches roll accumulation bugs.
- For any face, navigating to an adjacent face and back returns to the starting orientation.
- Cube-specific: the four-cycle `right → right → right → right` is identity. Same for `up`.

**Property-based tests:**
- Generate random valid navigation sequences of length 50, apply them, then apply the inverse sequence; assert the final quaternion equals the initial quaternion.

When you change the transition solver, run the cycle tests with `--repeats=100` to catch flaky edge cases.

### 3. Renderer (`src/render/`)

Because the renderer mutates DOM, it's tested in a real browser via `@vitest/browser`:

- Fixed input quaternion + fixed polyhedron → assert the `style.transform` string matches a precomputed reference (column-major matrix3d serialization).
- Resize the container → assert face matrices update and click zones recompute.
- Pointer-down in peripheral zone vs central zone → assert correct event (`navigate` vs scroll).

Renderer tests intentionally don't compare pixels — pixel diffs are flaky across browser versions. We compare the *transforms* and *opacities* the engine emits, which is what we control.

### 4. Other areas

- **Polyhedron validation:** every preset must pass `Euler V−E+F=2`, every edge shared by exactly two faces, every normal pointing outward.
- **Synchronization:** test all four sync modes, both bidirectional and unidirectional, and assert no feedback loops occur.
- **Persistence:** test localStorage success path, sessionStorage, custom adapter (sync and async), storage unavailable fallback, schema migration, and corrupted data handling.
- **Responsive:** simulate resizes via `ResizeObserver` mocks; assert breakpoint behavior switches.
- **Accessibility:** keyboard navigation reaches every face; `aria-live` announcements fire on navigation; focus order is sensible.

---

## Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(transitions): support icosahedron in transition solver
fix(input): center dead zone now respected on pentagon faces
docs(readme): clarify difference vs Three.js
test(math): add property-based slerp invariants
chore(build): bump tsup to 8.5
```

Types: `feat`, `fix`, `perf`, `refactor`, `test`, `docs`, `build`, `ci`, `chore`. Breaking changes use `feat!:` or include `BREAKING CHANGE:` in the body.

Conventional Commits drives the changelog and version bumps at release time, so it's not optional.

---

## Pull request process

Before opening a PR:

- [ ] Branch from `main`, named `feat/...`, `fix/...`, or `docs/...`.
- [ ] Code is formatted, linted, type-checked, and tested locally.
- [ ] New code has tests. New public APIs have JSDoc with at least one example.
- [ ] If you changed the transition solver, the cycle invariant tests pass.
- [ ] If you changed the public API, the README and `/examples/` are updated accordingly.
- [ ] The PR description explains *why*, not just *what* — link to the issue if one exists.

PRs that touch the public API or the rendering pipeline will get more review time. Expect at least one round of feedback; this is normal. We aim to respond within a week.

A maintainer will squash-merge when approved.

---

## Releases (maintainers only)

1. Ensure `main` is green on CI.
2. Run `npm run release` (uses [changesets](https://github.com/changesets/changesets)) to bump version and update CHANGELOG.
3. Push the tag: `git push --follow-tags`.
4. The `release.yml` workflow publishes to npm and deploys updated demos to GitHub Pages.

We follow [semver](https://semver.org/). Pre-1.0, minor versions can introduce breaking changes; patches are bug fixes only. Post-1.0, full semver guarantees apply.

---

## Areas where help is wanted

- Additional polyhedron presets (truncated cube, snub dodecahedron, etc.) under `src/polyhedra/presets/`.
- Framework wrappers (React, Vue, Svelte) — planned for v0.2 and likely to live in adjacent packages.
- Real-world example apps showcasing dashboards, galleries, or educational content.
- Accessibility audit by someone who uses screen readers regularly.
- Performance profiling on low-end mobile devices.

If any of these interest you, opening an issue to coordinate is the best first step.

---

## Code of Conduct

Be kind, be specific, assume good faith. Disagreements are welcome; personal attacks are not. Maintainers reserve the right to moderate discussions and remove contributions that violate this norm.

---

Thanks again for contributing. The library exists because of the people who take time to make it better.

— Lancrey
