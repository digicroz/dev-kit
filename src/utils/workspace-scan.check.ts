// Run: npx tsx src/utils/workspace-scan.check.ts
import assert from 'assert';
import { mkdtempSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { scanForRepoConfigs, mergeScanned } from './workspace-config.js';

const root = mkdtempSync(join(tmpdir(), 'wsscan-'));
mkdirSync(join(root, 'a'));
mkdirSync(join(root, 'b', 'c'), { recursive: true });
writeFileSync(join(root, 'a', 'ws.dk.json'), JSON.stringify({ workspace: 'W', name: 'A' }));
writeFileSync(join(root, 'b', 'c', 'ws.dk.json'), JSON.stringify({ workspace: 'W' }));

const found = scanForRepoConfigs(root);
assert.equal(found.length, 2);
assert.equal(found[1].module.name, 'c'); // name defaults to folder

const cfg = { version: '1', workspaces: [] as any[] };
mergeScanned(cfg, found);
mergeScanned(cfg, found); // idempotent
assert.equal(cfg.workspaces.length, 1);
assert.equal(cfg.workspaces[0].modules.length, 2);
console.log('ok');
