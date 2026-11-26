// Run: npx tsx src/utils/workspace-scan.check.ts
import assert from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { Workspace } from '../types/workspace.js';
import { scanForRepoConfigs, mergeScanned } from './workspace-config.js';

const root = mkdtempSync(join(tmpdir(), 'wsscan-'));
mkdirSync(join(root, 'a'));
mkdirSync(join(root, 'b', 'c'), { recursive: true });
writeFileSync(join(root, 'a', 'ws.dk.json'), JSON.stringify({ workspace: 'W', name: 'A' }));
writeFileSync(join(root, 'b', 'c', 'ws.dk.json'), JSON.stringify({ workspace: 'W' }));

const found = scanForRepoConfigs(root);
assert.equal(found.length, 2);
assert.equal(found[1]?.module.name, 'c'); // name defaults to folder

const cfg = { version: '1', workspaces: [] as Workspace[] };
mergeScanned(cfg, found);
mergeScanned(cfg, found); // idempotent
assert.equal(cfg.workspaces.length, 1);
assert.equal(cfg.workspaces[0]?.modules.length, 2);
mkdirSync(join(root, 'd'));
writeFileSync(join(root, 'd', 'ws.dk.json'), JSON.stringify({ workspace: 'First', order: -1 }));
mergeScanned(cfg, scanForRepoConfigs(root));
assert.equal(cfg.workspaces.find((w) => w.name === 'First')?.order, -1);
assert.equal(cfg.workspaces.find((w) => w.name === 'W')?.order, undefined); // default 0
console.log('ok');
