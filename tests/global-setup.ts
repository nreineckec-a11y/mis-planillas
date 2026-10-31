import { execFileSync } from 'node:child_process'

// Los fixtures se regeneran en cada corrida: siempre sintéticos, nunca datos reales.
export default function setup() {
  execFileSync(process.execPath, ['scripts/make-fixtures.mjs', 'tests/fixtures'], { stdio: 'inherit' })
}
