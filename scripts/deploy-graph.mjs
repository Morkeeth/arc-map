// Explicit operator deployment. The deploy credential stays inside this process.
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

if (!process.argv.includes('--publish')) throw new Error('Requires --publish');
const { GRAPH_DEPLOY_KEY: key, GRAPH_SUBGRAPH_SLUG: slug } = parseEnv(
  readFileSync(join(homedir(), '.config/arc-map/secrets/graph.env'), 'utf8'),
);
if (!key || !/^[a-fA-F0-9]{32}$/.test(key) || slug !== 'arcmap') {
  throw new Error('Saved Graph credential or slug does not match the required format.');
}
// Capture complete output before redaction, including chunks splitting a credential.
const stdout = process.stdout.write.bind(process.stdout);
let output = '';
for (const stream of [process.stdout, process.stderr]) {
  stream.write = (chunk, encoding, callback) => {
    output += Buffer.isBuffer(chunk) ? chunk.toString() : String(chunk);
    if (typeof encoding === 'function') encoding();
    if (typeof callback === 'function') callback();
    return true;
  };
}
process.on('exit', () => stdout(output.split(key).join('[REDACTED]')));
delete process.env.DEBUG;
const root = resolve('subgraphs/arcmap');
process.chdir(root);
const { default: Deploy } = await import(join(root, 'node_modules/@graphprotocol/graph-cli/dist/commands/deploy.js'));
await Deploy.run([
  'arcmap', '--node', 'https://api.studio.thegraph.com/deploy/',
  '--deploy-key', key, '--version-label', 'v0.1.0',
], join(root, 'node_modules/@graphprotocol/graph-cli'));
