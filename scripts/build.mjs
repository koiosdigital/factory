// Builds the SPA with the non-secret VITE_* vars from wrangler.jsonc injected
// into the environment, so wrangler.jsonc stays the single source of truth for
// build-time configuration. Existing process.env values (e.g. CI overrides or a
// local .env) take precedence and are left untouched.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const wranglerPath = fileURLToPath(new URL('../wrangler.jsonc', import.meta.url))

// Minimal JSONC -> JSON: strip block/line comments and trailing commas.
const stripJsonc = (text) =>
  text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/,(\s*[}\]])/g, '$1')

const config = JSON.parse(stripJsonc(readFileSync(wranglerPath, 'utf8')))
const vars = config.vars ?? {}

for (const [key, value] of Object.entries(vars)) {
  if (process.env[key] === undefined) {
    process.env[key] = String(value)
  }
}

const result = spawnSync('vite', ['build'], { stdio: 'inherit', env: process.env, shell: true })
process.exit(result.status ?? 1)
