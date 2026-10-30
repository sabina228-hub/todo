# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"할 일 목록" — a small todo app: add, check off, edit, delete, filter (전체/진행 중/완료), and clear completed. `README.md` is the Korean user-facing summary. Shared environment notes (Windows, Korean path, headless Chrome testing) are in `../CLAUDE.md`.

## Constraints

- Plain HTML, CSS, and vanilla JS only: no frameworks, libraries, CDNs, external fonts, or build tools. Source is `index.html`, `style.css`, `app.js`.
- Must work when `index.html` is opened directly over `file://`: one plain `<script>` tag at the end of `<body>`, no ES modules or `fetch`.
- Put user text on screen with `textContent`, never `innerHTML`.
- Korean comments, English identifiers. No `console.log` or test helpers left in the source.

## Verifying

No build or test tooling. Open `index.html` in a browser. For automated checks, follow `../CLAUDE.md`: top-level functions, `state`, `els`, and `STORAGE_KEY` are globals a test script can call. Use a fresh `--user-data-dir` for each run, because saved todos persist in the profile. At 360px width, check that a long unbroken todo causes no horizontal scroll.

## How app.js works

- `state = { todos, filter, editingId }`; a todo is `{ id, text, done }`. Only `todos` is saved, as a JSON array under localStorage key `todo-list:v1`. All `file://` pages share one localStorage, so the key must stay distinct from other projects (Study-02 uses `todo-app:v1`). `filter` resets to `all` on reload.
- `load()` falls back to an empty list on missing or corrupt data and drops invalid entries. `save()` never throws; on failure it shows `#save-error`.
- Every state change goes through `update(change)`: finish any open edit, apply the change, `save()`, `render()`. New todos go to the top; adding while the 완료 filter is active switches to 전체.
- `render()` rebuilds the whole list. To keep keyboard focus, it records the focused row and control (`data-action`: `toggle`/`edit`/`delete`) and restores it, falling back to the row now at the same index.
- Editing swaps only that one row (`startEdit`/`endEdit`), never the whole list, so a click or Tab that ends an edit via `focusout` still reaches its target. `endEdit` clears `editingId` before touching the DOM; that guard stops a second `focusout` from running it twice. Enter saves, Esc cancels, blur saves, empty text keeps the old text, and Enter during IME composition (`isComposing`) is ignored.
- CSS: colors are `:root` variables; `[hidden]` is forced to `display: none`; `body` uses `word-break: keep-all` (Korean breaks at spaces) and `.todo-text` adds `overflow-wrap: anywhere` for long unbroken text.
