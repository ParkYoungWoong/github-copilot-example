// Word(.docx) 양식의 {{칸 이름}} 자리를 JSON 파일의 값으로 채워서 새 Word 파일로 저장합니다.
// 칸 목록 보기: node scripts/fill-docx.js <양식.docx>
// 양식 채우기: node scripts/fill-docx.js <양식.docx> <값.json> [결과.docx]
//
// 양식을 만드는 방법
// - 채울 자리에 {{신청자}}처럼 칸 이름을 중괄호 두 쌍으로 감싸서 적습니다.
// - 표의 한 줄에 {{높음.번호}}, {{높음.제목}}처럼 '목록.열' 이름을 적으면, 값의 "높음" 배열 길이만큼 그 줄이 반복됩니다.
// - 문단 하나에 {{다음 조치}}만 적고 값으로 배열을 주면, 배열 길이만큼 그 문단이 반복됩니다.
// - 배열이 비어 있으면 '해당 없음' 한 줄을 남깁니다.
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

// 칸을 채울 Word 내부 파일(본문, 머리글, 바닥글)
const TARGET_PARTS = /^word\/(document|header\d*|footer\d*)\.xml$/
const PLACEHOLDER = /\{\{\s*([^{}]+?)\s*\}\}/g
const EMPTY_TEXT = '해당 없음'

/** 압축 파일 검사에 쓰는 CRC-32 표를 만듭니다. */
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

/** 바이트 배열의 CRC-32 값을 계산합니다. */
function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

/** .docx(zip) 파일을 읽어서 항목 목록으로 돌려줍니다. */
function readZip(buffer) {
  let end = buffer.length - 22
  while (end >= 0 && buffer.readUInt32LE(end) !== 0x06054b50) end -= 1
  if (end < 0) throw new Error('Word(.docx) 파일이 아니거나 손상된 파일입니다.')
  const count = buffer.readUInt16LE(end + 10)
  let offset = buffer.readUInt32LE(end + 16)
  const entries = []
  for (let i = 0; i < count; i += 1) {
    const nameLength = buffer.readUInt16LE(offset + 28)
    const extraLength = buffer.readUInt16LE(offset + 30)
    const commentLength = buffer.readUInt16LE(offset + 32)
    const entry = {
      method: buffer.readUInt16LE(offset + 10),
      time: buffer.readUInt16LE(offset + 12),
      date: buffer.readUInt16LE(offset + 14),
      crc: buffer.readUInt32LE(offset + 16),
      compressedSize: buffer.readUInt32LE(offset + 20),
      size: buffer.readUInt32LE(offset + 24),
      name: buffer.toString('utf8', offset + 46, offset + 46 + nameLength)
    }
    const local = buffer.readUInt32LE(offset + 42)
    const dataStart = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28)
    entry.data = buffer.subarray(dataStart, dataStart + entry.compressedSize)
    entries.push(entry)
    offset += 46 + nameLength + extraLength + commentLength
  }
  return entries
}

/** 압축된 항목의 내용을 글자로 풉니다. */
function entryText(entry) {
  const raw = entry.method === 8 ? zlib.inflateRawSync(entry.data) : entry.data
  return raw.toString('utf8')
}

/** 항목의 내용을 새 글자로 바꾸고 다시 압축합니다. */
function setEntryText(entry, text) {
  const raw = Buffer.from(text, 'utf8')
  entry.method = 8
  entry.data = zlib.deflateRawSync(raw)
  entry.crc = crc32(raw)
  entry.size = raw.length
  entry.compressedSize = entry.data.length
}

/** 항목 목록을 .docx(zip) 파일 바이트로 묶습니다. */
function writeZip(entries) {
  const locals = []
  const centrals = []
  let offset = 0
  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8')
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0x0800, 6)
    local.writeUInt16LE(entry.method, 8)
    local.writeUInt16LE(entry.time, 10)
    local.writeUInt16LE(entry.date, 12)
    local.writeUInt32LE(entry.crc, 14)
    local.writeUInt32LE(entry.compressedSize, 18)
    local.writeUInt32LE(entry.size, 22)
    local.writeUInt16LE(name.length, 26)
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    local.copy(central, 8, 6, 26)
    central.writeUInt16LE(name.length, 28)
    central.writeUInt32LE(offset, 42)
    locals.push(local, name, entry.data)
    centrals.push(central, name)
    offset += local.length + name.length + entry.data.length
  }
  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(centralSize, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, ...centrals, end])
}

/** XML에 넣을 수 있도록 특수 문자를 바꿉니다. */
function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** 값의 줄바꿈을 Word의 줄바꿈으로 바꿔서 XML 조각으로 만듭니다. */
function valueXml(value) {
  return escapeXml(value).split(/\r?\n/).join('</w:t><w:br/><w:t xml:space="preserve">')
}

/** 문단 XML에서 보이는 글자만 모읍니다. */
function paragraphText(xml) {
  return [...xml.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map(match => match[1]).join('')
}

/** Word가 여러 조각으로 나눠 저장한 {{칸 이름}}을 한 조각으로 모읍니다. */
function joinSplitPlaceholders(xml) {
  return xml.replace(/<w:p[ >][\s\S]*?<\/w:p>/g, paragraph => {
    const pieces = []
    let start = 0
    for (const match of paragraph.matchAll(/(<w:t(?:\s[^>]*)?>)([^<]*)(<\/w:t>)/g)) {
      pieces.push({ index: match.index, raw: match[0], text: match[2], start })
      start += match[2].length
    }
    const full = pieces.map(piece => piece.text).join('')
    const matches = [...full.matchAll(PLACEHOLDER)]
    if (!matches.length) return paragraph
    const texts = pieces.map(piece => piece.text)
    const touched = new Set()
    for (const match of matches.reverse()) {
      const from = match.index
      const to = from + match[0].length
      const first = pieces.findIndex(piece => from < piece.start + piece.text.length)
      const last = pieces.findIndex(piece => to <= piece.start + piece.text.length)
      touched.add(first)
      if (first === last) continue
      texts[first] = texts[first].slice(0, from - pieces[first].start) + match[0] + texts[last].slice(to - pieces[last].start)
      for (let i = first + 1; i <= last; i += 1) texts[i] = ''
    }
    let result = ''
    let cursor = 0
    pieces.forEach((piece, i) => {
      const open = touched.has(i) ? '<w:t xml:space="preserve">' : piece.raw.slice(0, piece.raw.indexOf('>') + 1)
      result += paragraph.slice(cursor, piece.index) + `${open}${texts[i]}</w:t>`
      cursor = piece.index + piece.raw.length
    })
    return result + paragraph.slice(cursor)
  })
}

/** 목록이 비었을 때 줄의 칸을 하나로 합치고 '해당 없음'만 남깁니다. */
function emptyRow(row) {
  const cells = row.match(/<w:tc>[\s\S]*?<\/w:tc>/g) ?? []
  if (!cells.length) return row.replace(PLACEHOLDER, '')
  let first = cells[0].replace(PLACEHOLDER, '')
  first = first.replace(/<w:t(?:\s[^>]*)?>[^<]*<\/w:t>/, `<w:t xml:space="preserve">${EMPTY_TEXT}</w:t>`)
  if (cells.length > 1) {
    // 합친 칸의 너비는 원래 칸 너비의 합으로 맞춥니다.
    const width = cells.reduce((sum, cell) => sum + Number(cell.match(/<w:tcW[^>]*w:w="(\d+)"/)?.[1] ?? 0), 0)
    const span = `<w:tcW w:w="${width}" w:type="${width ? 'dxa' : 'auto'}"/><w:gridSpan w:val="${cells.length}"/>`
    first = /<w:tcW[^>]*\/>/.test(first)
      ? first.replace(/<w:tcW[^>]*\/>/, span)
      : first.replace(/<w:tcPr>/, `<w:tcPr>${span}`)
  }
  const start = row.indexOf(cells[0])
  const end = row.lastIndexOf(cells.at(-1)) + cells.at(-1).length
  return row.slice(0, start) + first + row.slice(end)
}

/** 표에서 {{목록.열}}이 들어 있는 줄을 목록 길이만큼 반복합니다. */
function expandRows(xml, values, missing) {
  return xml.replace(/<w:tr[ >][\s\S]*?<\/w:tr>/g, row => {
    const listName = [...paragraphText(row).matchAll(PLACEHOLDER)].map(match => match[1]).find(name => name.includes('.'))?.split('.')[0]
    if (!listName) return row
    const items = values[listName]
    if (!Array.isArray(items)) {
      missing.add(`${listName} (배열)`)
      return row
    }
    if (!items.length) return emptyRow(row)
    return items
      .map(item =>
        row.replace(PLACEHOLDER, (all, name) => {
          if (!name.startsWith(`${listName}.`)) return all
          const field = name.slice(listName.length + 1)
          if (!(field in item)) missing.add(name)
          return valueXml(item[field])
        })
      )
      .join('')
  })
}

/** 값이 배열인 {{칸 이름}}이 들어 있는 문단을 배열 길이만큼 반복합니다. */
function expandParagraphs(xml, values) {
  return xml.replace(/<w:p[ >][\s\S]*?<\/w:p>/g, paragraph => {
    const name = [...paragraphText(paragraph).matchAll(PLACEHOLDER)].map(match => match[1]).find(key => Array.isArray(values[key]))
    if (!name) return paragraph
    const items = values[name].length ? values[name] : [EMPTY_TEXT]
    return items.map(item => paragraph.replace(PLACEHOLDER, (all, key) => (key === name ? valueXml(item) : all))).join('')
  })
}

/** 남은 {{칸 이름}}을 값으로 바꿉니다. */
function fillValues(xml, values, missing) {
  return xml.replace(PLACEHOLDER, (all, name) => {
    if (!(name in values) || typeof values[name] === 'object') {
      missing.add(name.includes('.') ? `${name.split('.')[0]} (배열)` : name)
      return all
    }
    return valueXml(values[name])
  })
}

/** 양식에 있는 칸을 모아서 값 파일의 뼈대(JSON)를 만듭니다. */
function listFields(entries) {
  const fields = {}
  for (const entry of entries.filter(item => TARGET_PARTS.test(item.name))) {
    const xml = joinSplitPlaceholders(entryText(entry))
    for (const paragraph of xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? []) {
      const isList = /<w:numPr>|<w:pStyle w:val="[^"]*List/.test(paragraph)
      for (const [, name] of paragraphText(paragraph).matchAll(PLACEHOLDER)) {
        if (name.includes('.')) {
          const [listName, field] = [name.slice(0, name.indexOf('.')), name.slice(name.indexOf('.') + 1)]
          fields[listName] ??= [{}]
          fields[listName][0][field] = ''
        } else {
          fields[name] ??= isList ? [''] : ''
        }
      }
    }
  }
  return fields
}

/** 명령줄 인수를 읽고 칸 목록을 보여 주거나 양식을 채웁니다. */
function main() {
  const [templatePath, valuesPath, outputArg] = process.argv.slice(2)
  if (!templatePath || !fs.existsSync(templatePath)) {
    console.error('사용법: node scripts/fill-docx.js <양식.docx> [값.json] [결과.docx]')
    process.exit(1)
  }
  const entries = readZip(fs.readFileSync(templatePath))

  if (!valuesPath) {
    console.log(`양식의 칸 목록: ${templatePath}`)
    console.log(JSON.stringify(listFields(entries), null, 2))
    return
  }
  if (!fs.existsSync(valuesPath)) {
    console.error(`${valuesPath} 파일이 없습니다. 먼저 칸 목록을 보고 값 파일(JSON)을 만드세요.`)
    process.exit(1)
  }

  let values
  try {
    values = JSON.parse(fs.readFileSync(valuesPath, 'utf8'))
  } catch (error) {
    console.error(`${valuesPath} 파일의 JSON 형식이 올바르지 않습니다: ${error.message}`)
    process.exit(1)
  }
  const missing = new Set()
  for (const entry of entries.filter(item => TARGET_PARTS.test(item.name))) {
    let xml = joinSplitPlaceholders(entryText(entry))
    xml = expandRows(xml, values, missing)
    xml = expandParagraphs(xml, values)
    xml = fillValues(xml, values, missing)
    setEntryText(entry, xml)
  }
  if (missing.size) {
    console.error(`값 파일에 없는 칸이 있어서 저장하지 않았습니다: ${[...missing].join(', ')}`)
    process.exit(1)
  }

  const outputPath = outputArg ?? valuesPath.replace(/\.json$/i, '') + '.docx'
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, writeZip(entries))
  console.log(`양식 작성: ${outputPath}`)
  console.log(`  양식 ${templatePath}, 값 ${Object.keys(values).length}개`)
}

main()
