# Running the local build as a CLI

Test changes on your own machine without publishing to npm.

## Setup (once)

A `.cmd` file on your PATH works from cmd, PowerShell, Git Bash and the VS Code terminal. It needs
no profile and no execution-policy change (that policy only affects `.ps1` scripts).

1. Pick a folder that is already on your PATH (list them with `$env:PATH -split ';'`), or create
   one such as `C:\Users\Admin\bin` and add it to your user PATH.

2. Create `dkl.cmd` in that folder:

   ```bat
   @node C:\digicroz-repos\npm-packages\dev-kit\dist\cli.js %*
   ```

3. Open a new terminal and run `dkl ws list`.

`dkl` runs your local build and stays separate from the published `dk`. Naming it `dk.cmd` instead
may or may not win over a globally installed `dk`, depending on PATH order, so `dkl` is safer.

## Every change

```bash
cd C:\digicroz-repos\npm-packages\dev-kit
npm run build        # or: npx tsup --watch  (in a second terminal)
dkl ws scan C:/projects
```

## Why not `npm link`?

`npm prefix -g` points into a vite-plus managed node folder
(`...\vite-plus\data\js_runtime\node\<version>`). That folder must be on PATH, and a node
version update creates a new folder, which loses the link. The `.cmd` file avoids both
problems.

If you still want it: `npm link` (after `npm run build`), then check `where.exe dk`.
Undo with `npm unlink -g <package-name>`.

## Testing without touching your real config

The workspace config lives at `~/.digicroz/dk/workspaces.config.json`. To test against a throwaway one:

```powershell
$env:USERPROFILE = "$env:TEMP\dk-test"; dkl ws scan C:/projects
```

Close the terminal (or reset `$env:USERPROFILE`) afterwards. In cmd, use
`set USERPROFILE=%TEMP%\dk-test` instead.
