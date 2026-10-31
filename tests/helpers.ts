import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { readWorkbook } from '../src/lib/xlsx/reader'

export const fixture = (name: string) => new Uint8Array(readFileSync(join(__dirname, 'fixtures', name)))
export const libro = (name: string) => readWorkbook(fixture(name))
