// 이슈 목록(CSV)을 읽어서 docs/issue-rules.md 규칙대로 유형과 우선순위를 판정합니다.
// 실행: node scripts/triage.js
import fs from 'node:fs'
import path from 'node:path'

const INPUT = 'data/issues.csv'
const OUTPUT_CSV = 'output/triage-result.csv'
const OUTPUT_MD = 'output/triage-result.md'

// 유형 판정 키워드. 위에 있는 유형이 우선합니다.
const TYPE_RULES = [
  { type: '버그', keywords: ['오류', '실패', '멈춤', '끊김', '고정', '안 됨', '안됨', '튐', '튀는', '깨짐', '가득', '만료', '손실'] },
  { type: '기능요청', keywords: ['추가', '지원', '개선', '옵션'] },
  { type: '문의', keywords: ['문의', '방법', '어떻게', '절차'] }
]
// 버그이면서 이 키워드가 있으면 우선순위 높음.
const HIGH_KEYWORDS = ['양산', '고객', '전체', '데이터 손실', '안전']
// 버그이지만 재현 조건이 없다고 보는 표현.
const UNCLEAR_KEYWORDS = ['가끔', '모르', '불규칙']
// 내용이 이 길이보다 짧으면 근거 부족으로 미판정.
const MIN_LENGTH = 15

/** 큰따옴표로 감싼 값을 처리하는 간단한 CSV 파서 */
export function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"'
        i += 1
      } else if (ch === '"') {
        inQuotes = false
      } else {
        field += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (ch !== '\r') {
      field += ch
    }
  }
  if (field || row.length) {
    row.push(field)
    rows.push(row)
  }
  const [header, ...body] = rows
  return body
    .filter(cells => cells.some(cell => cell.trim()))
    .map(cells => Object.fromEntries(header.map((key, i) => [key.trim(), (cells[i] ?? '').trim()])))
}

/** 값을 CSV 셀로 감쌉니다. */
function toCell(value) {
  const text = String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function includesAny(text, keywords) {
  return keywords.find(keyword => text.includes(keyword)) ?? ''
}

/** 제목과 내용에서 유형을 정합니다. */
export function judgeType(text) {
  for (const rule of TYPE_RULES) {
    const hit = includesAny(text, rule.keywords)
    if (hit) return { type: rule.type, reason: `키워드 "${hit}"` }
  }
  return { type: '기타', reason: '키워드 없음' }
}

/** 유형과 본문으로 우선순위를 정합니다. */
export function judgePriority(type, text) {
  if (type !== '버그') return { priority: '낮음', reason: `${type}이므로 낮음` }
  const hit = includesAny(text, HIGH_KEYWORDS)
  if (hit) return { priority: '높음', reason: `버그 + 키워드 "${hit}"` }
  return { priority: '중간', reason: '그 밖의 버그' }
}

/** 접수일 값이 실제 날짜인지, 미래가 아닌지 확인합니다. */
export function checkDate(value, today = new Date()) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return '접수일 형식 오류'
  const [, y, m, d] = match.map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  const isReal = date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
  if (!isReal) return '접수일 형식 오류'
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  if (date.getTime() > todayUtc) return '접수일 미래'
  return ''
}

/** 이슈 한 건을 판정합니다. */
export function triage(issue, today = new Date()) {
  const text = `${issue.제목} ${issue.내용}`
  const notes = []
  const { type, reason: typeReason } = judgeType(text)
  const { priority, reason: priorityReason } = judgePriority(type, text)
  let status = '판정'

  if (issue.내용.length < MIN_LENGTH) {
    status = '미판정'
    notes.push('근거 부족')
  } else if (type === '기타') {
    status = '미판정'
    notes.push('유형 불명')
  } else if (type === '버그' && includesAny(issue.내용, UNCLEAR_KEYWORDS)) {
    status = '미판정'
    notes.push('재현 조건 없음')
  }

  const dateNote = checkDate(issue.접수일, today)
  if (dateNote) notes.push(dateNote)

  return {
    번호: issue.번호,
    제목: issue.제목,
    접수자: issue.접수자,
    접수일: issue.접수일,
    유형: status === '판정' ? type : '',
    우선순위: status === '판정' ? priority : '',
    상태: status,
    비고: notes.join(', '),
    근거: status === '판정' ? `${typeReason}, ${priorityReason}` : notes[0]
  }
}

function toMarkdownTable(rows, columns) {
  const header = `| ${columns.join(' | ')} |`
  const divider = `| ${columns.map(() => '---').join(' | ')} |`
  const body = rows.map(row => `| ${columns.map(column => row[column] ?? '').join(' | ')} |`)
  return [header, divider, ...body].join('\n')
}

function main() {
  const text = fs.readFileSync(INPUT, 'utf8')
  const issues = parseCsv(text)
  const results = issues.map(issue => triage(issue))

  const columns = ['번호', '제목', '유형', '우선순위', '상태', '비고', '근거']
  const csv = [columns.map(toCell).join(','), ...results.map(row => columns.map(column => toCell(row[column])).join(','))].join('\n')
  fs.mkdirSync(path.dirname(OUTPUT_CSV), { recursive: true })
  fs.writeFileSync(OUTPUT_CSV, `${csv}\n`)

  const counts = {
    전체: results.length,
    높음: results.filter(row => row.우선순위 === '높음').length,
    중간: results.filter(row => row.우선순위 === '중간').length,
    낮음: results.filter(row => row.우선순위 === '낮음').length,
    미판정: results.filter(row => row.상태 === '미판정').length,
    별도표기: results.filter(row => row.상태 === '판정' && row.비고).length
  }
  const pending = results.filter(row => row.상태 === '미판정')
  const flagged = results.filter(row => row.상태 === '판정' && row.비고)
  const md = [
    '# 이슈 판정표',
    '',
    `기준 문서: docs/issue-rules.md, 입력: ${INPUT}`,
    '',
    '## 요약',
    '',
    toMarkdownTable(
      Object.entries(counts).map(([구분, 건수]) => ({ 구분, 건수 })),
      ['구분', '건수']
    ),
    '',
    '## 판정 결과',
    '',
    toMarkdownTable(results, ['번호', '제목', '유형', '우선순위', '상태', '비고']),
    '',
    '## 미판정 (담당자 확인 필요)',
    '',
    pending.length ? toMarkdownTable(pending, ['번호', '제목', '접수자', '비고']) : '해당 없음',
    '',
    '## 별도 표기',
    '',
    flagged.length ? toMarkdownTable(flagged, ['번호', '제목', '비고']) : '해당 없음',
    '',
    '## 판정 근거',
    '',
    toMarkdownTable(results, ['번호', '근거']),
    ''
  ].join('\n')
  fs.writeFileSync(OUTPUT_MD, md)

  console.log(`판정 완료: ${counts.전체}건`)
  console.log(`  높음 ${counts.높음}, 중간 ${counts.중간}, 낮음 ${counts.낮음}, 미판정 ${counts.미판정}, 별도 표기 ${counts.별도표기}`)
  console.log(`결과 파일: ${OUTPUT_MD}, ${OUTPUT_CSV}`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  main()
}
