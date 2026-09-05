// 검증셋(tests/cases.json)과 판정 결과(output/triage-result.csv)를 비교합니다.
// 실행: node scripts/check.js
import fs from 'node:fs'
import { parseCsv } from './triage.js'

const CASES = 'tests/cases.json'
const RESULT = 'output/triage-result.csv'

function classify(expected, actual) {
  if (!actual) return '결과 없음'
  if (expected.상태 === '미판정' && actual.상태 === '판정') return '미탐'
  if (expected.상태 === '판정' && actual.상태 === '미판정') return '오탐'
  if (expected.상태 === '판정' && (expected.유형 !== actual.유형 || expected.우선순위 !== actual.우선순위)) return '오판정'
  if (expected.비고 && !actual.비고.includes(expected.비고)) return '비고 누락'
  return '일치'
}

function main() {
  if (!fs.existsSync(RESULT)) {
    console.error(`${RESULT} 파일이 없습니다. 먼저 node scripts/triage.js 를 실행하세요.`)
    process.exit(1)
  }
  const cases = JSON.parse(fs.readFileSync(CASES, 'utf8'))
  const results = Object.fromEntries(parseCsv(fs.readFileSync(RESULT, 'utf8')).map(row => [row.번호, row]))

  const lines = cases.map(expected => {
    const actual = results[expected.번호]
    const verdict = classify(expected, actual)
    const got = actual ? `${actual.상태} ${actual.유형} ${actual.우선순위} ${actual.비고}`.trim() : '-'
    const want = `${expected.상태} ${expected.유형 ?? ''} ${expected.우선순위 ?? ''} ${expected.비고 ?? ''}`.trim()
    return { 번호: expected.번호, 구분: expected.구분, 기대: want, 결과: got, 판정: verdict }
  })

  const width = { 번호: 4, 구분: 4, 기대: 22, 결과: 22, 판정: 6 }
  const pad = (text, size) => String(text).padEnd(size, ' ')
  console.log(['번호', '구분', '기대', '결과', '판정'].map(key => pad(key, width[key])).join('  '))
  for (const line of lines) {
    console.log(['번호', '구분', '기대', '결과', '판정'].map(key => pad(line[key], width[key])).join('  '))
  }

  const counts = {}
  for (const line of lines) counts[line.판정] = (counts[line.판정] ?? 0) + 1
  const summary = Object.entries(counts).map(([key, value]) => `${key} ${value}`).join(', ')
  console.log(`\n검증 ${lines.length}건: ${summary}`)

  const failed = lines.filter(line => line.판정 !== '일치').length
  process.exit(failed ? 1 : 0)
}

main()
