# Rust tooling migration notes

Migrated from ESLint + Prettier + tsup to oxlint (type-aware via oxlint-tsgolint) + oxfmt + tsdown
(Rolldown). Same setup as `dummyx-v3/backend`. `tsc --noEmit` is kept for typechecking.

## Scripts

| Script                    | Tool                                                 |
| ------------------------- | ---------------------------------------------------- |
| `build` / `dev`           | `tsdown` / `tsdown --watch` (`tsdown.config.ts`)     |
| `lint`                    | `oxlint --fix`                                       |
| `lint:check`              | `oxlint --max-warnings 216` (errors fail; see below) |
| `format` / `format:check` | `oxfmt` / `oxfmt --check`                            |
| `typecheck`               | `tsc --noEmit`                                       |
| `check`                   | lint:check + format:check + typecheck                |
| `fix`                     | lint + format                                        |

## Git hooks

- `.husky/pre-commit` (fast, staged files only): block `.env` files, bad paths and conflict markers,
  then `lint-staged` (`oxlint --fix` + `oxfmt`).
- `.husky/pre-push` (slow, whole repo): `npm run check` and `npm run build`, the same gate as CI.

## Keeping the code clean (anti-slop rules)

`.oxlintrc.json` turns on the `correctness` category as errors and `suspicious` as warnings, plus
rules aimed at leftovers and noise: `no-debugger`, `no-alert`, `no-empty` (empty catch blocks need a
comment), `no-useless-*`, `no-else-return`, `no-nested-ternary`, `no-param-reassign`, `complexity`,
`max-depth`, `max-params`, `import/no-cycle`, `typescript/no-explicit-any`,
`typescript/no-non-null-assertion`, `typescript/ban-ts-comment` (needs a description), floating and
misused promises, and unnecessary conditions or assertions.

**Warning ratchet.** The existing code has 216 warnings (mostly `no-explicit-any`,
`prefer-nullish-coalescing`, `no-unsafe-type-assertion`, `no-unnecessary-condition`). They are not
fixed in this migration. `lint:check` uses `--max-warnings 216`, so new warnings fail CI. **When you
fix some, lower the number in `package.json`.**

## Notes

- `tsconfig.json`: `moduleResolution` is now `Bundler` (`Node`/node10 is removed in the native
  tsgolint) and `target` is `ES2022` (needed for `new Error(msg, { cause })`).
- `typescript` stays on 5.x: tsdown's `dts` generation uses the TypeScript API, which 7.0 no longer
  ships. If you move to 7, set `dts: false` and emit types with `tsc --emitDeclarationOnly`.
- The destructured exports at the end of `ui-helpers.ts` (`success`, `error`, ...) were removed: nothing
  used them and they lose `this` when destructured.
- VS Code: install `oxc.oxc-vscode`. It keeps `oxlint --lsp` / `oxfmt --lsp` running, which lock binaries
  in `node_modules` on Windows; close VS Code before `npm ci`.
