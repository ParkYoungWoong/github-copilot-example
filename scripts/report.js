// 판정 결과(output/triage-result.csv)로 docs/report-template.md 형식의 보고서를 만듭니다.
// 실행: node scripts/report.js
import fs from 'node:fs'
import { parseCsv } from './triage.js'

const INPUT = 'output/triage-result.csv'
const OUTPUT = 'output/report.md'

/** docs/issue-rules.md의 담당자 배정 규칙 */
function assignOwner(row) {
  if (row.상태 === '미판정') return '접수자 재확인'
  if (row.우선순위 === '높음') return '파트장'
  if (row.유형 === '버그') return '개발 파트'
  if (row.유형 === '기능요청') return '기획 파트'
  if (row.유형 === '문의') return '기술지원 파트'
  return '파트장'
}

function table(rows, columns) {
  if (!rows.length) return '해당 없음'
  const header = `| ${columns.join(' | ')} |`
  const divider = `| ${columns.map(() => '---').join(' | ')} |`
  const body = rows.map(row => `| ${columns.map(column => row[column] ?? '').join(' | ')} |`)
  return [header, divider, ...body].join('\n')
}

function main() {
  if (!fs.existsSync(INPUT)) {
    console.error(`${INPUT} 파일이 없습니다. 먼저 node scripts/triage.js 를 실행하세요.`)
    process.exit(1)
  }
  const rows = parseCsv(fs.readFileSync(INPUT, 'utf8')).map(row => ({ ...row, 담당: assignOwner(row) }))
  const today = new Date().toISOString().slice(0, 10)
  const high = rows.filter(row => row.우선순위 === '높음')
  const pending = rows.filter(row => row.상태 === '미판정')
  const flagged = rows.filter(row => row.상태 === '판정' && row.비고)

  const nextActions = [
    ...high.map(row => `- [${row.번호}] ${row.제목}: 파트장에게 즉시 통보`),
    ...pending.map(row => `- [${row.번호}] ${row.제목}: 접수자에게 ${row.비고} 재확인 요청`)
  ]

  const md = `# 이슈 판정 보고 (${today})

## 요약

| 구분 | 건수 |
| --- | --- |
| 전체 | ${rows.length} |
| 우선순위 높음 | ${high.length} |
| 미판정 | ${pending.length} |
| 별도 표기 | ${flagged.length} |

## 우선순위 높음 (즉시 통보)

${table(high, ['번호', '제목', '유형', '담당'])}

## 미판정 (재확인 요청)

${table(pending, ['번호', '제목', '비고', '담당'])}

## 별도 표기

${table(flagged, ['번호', '제목', '비고'])}

## 통보 대상

- 파트장: 우선순위 높음 ${high.length}건
- 접수자: 미판정 ${pending.length}건 재확인 요청

## 다음 조치

${nextActions.length ? nextActions.join('\n') : '- 해당 없음'}
`
  fs.writeFileSync(OUTPUT, md)
  console.log(`보고서 생성: ${OUTPUT}`)
  console.log(`  높음 ${high.length}건, 미판정 ${pending.length}건, 별도 표기 ${flagged.length}건`)
}

main()
