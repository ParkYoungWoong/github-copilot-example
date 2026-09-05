// Copilot이 도구를 실행하기 직전에 호출됩니다.
// 아래 목록의 파일이나 폴더를 건드리는 요청이면 종료 코드 2로 거부합니다.
import fs from 'node:fs'

// 차단할 경로 목록입니다. .gitignore처럼 적습니다.
// 이름만 적으면 어느 폴더에 있어도 막고, 경로를 적으면 그 위치만 막습니다.
// *는 이름 안의 아무 글자, **는 폴더 경계를 넘는 아무 글자를 뜻합니다.
const BLOCKED = [
  '.env*', // .env, .env.local, .env.production
  '*.pem', // 인증서와 개인 키
  'secrets/**', // secrets 폴더 안의 모든 파일
  'config/credentials.json',
]

// 'config/*.json' 같은 패턴을 정규식으로 바꿉니다.
function toRegExp(pattern) {
  const source = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // 정규식에서 특별한 뜻을 가진 문자는 글자 그대로 취급
    .split('**')
    .map(part => part.replace(/\*/g, '[^/]*'))
    .join('.*')
  return new RegExp(`(^|/)${source}$`, 'i')
}

const { tool_input } = JSON.parse(fs.readFileSync(0, 'utf8'))

// 파일 경로, 검색 패턴, 터미널 명령 어디에 있든 경로 단위로 잘라서 검사합니다.
const paths = JSON.stringify(tool_input)
  .replace(/\\+/g, '/') // Windows 경로 구분자 통일
  .split(/[\s"'`|;&<>(),=]+/)
const matchers = BLOCKED.map(toRegExp)
const blocked = paths.find(path => matchers.some(matcher => matcher.test(path)))

if (blocked) {
  console.error(`${blocked} 경로는 읽거나 수정할 수 없습니다.`)
  process.exit(2)
}
