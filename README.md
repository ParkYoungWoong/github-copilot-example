# GitHub Copilot 업무 비서 예제

VS Code와 GitHub Copilot으로 연구개발팀의 반복 업무를 맡기는 예제입니다.
가상의 온도 센서 모듈 TS-100을 만드는 팀을 배경으로, 팀 FAQ 답변, 노트북 신청 양식 작성, 회의록 정리, 이슈 판정, 보고서 생성을 다룹니다.
신청서와 보고서는 팀의 Word(.docx) 양식에 채워서 Word 파일로도 만듭니다.
[GitHub Copilot 업무 비서 만들기](https://www.heropy.dev/p/PgnSNw) 글에서 단계별로 사용하고, 기능 설명은 [GitHub Copilot 핵심 정리](https://www.heropy.dev/p/AbbCk6)에 있습니다.

## 준비

- [VS Code](https://code.visualstudio.com/)와 [Node.js](https://nodejs.org/) 22 이상
- VS Code에서 GitHub 계정으로 로그인(Copilot Free 플랜으로도 실습할 수 있습니다)

외부 패키지를 사용하지 않으므로 별도의 설치 명령은 없습니다.

## 브랜치

| 브랜치 | 내용 |
| --- | --- |
| `main` | 실습을 시작하는 상태. 글에서 Copilot에게 만들게 하는 판정, 보고 스크립트와 실습 결과물은 들어 있지 않습니다 |
| `complete` | 글의 실습을 끝까지 따라 한 완성본. 만든 스크립트와 비교하거나, 실습이 막혔을 때 받아서 이어 갑니다 |

`Code > Download ZIP`은 `main`을 받습니다. 완성본은 브랜치 메뉴에서 `complete`를 고른 뒤 같은 방법으로 받습니다.

## 구조

```plaintext
.
├── .github/
│   ├── copilot-instructions.md   # 모든 요청에 적용되는 팀 규칙
│   ├── instructions/             # 특정 파일에만 적용되는 규칙
│   ├── agents/                   # 이슈 판정 전용 커스텀 에이전트
│   ├── skills/                   # team-faq, laptop-request, meeting-notes, issue-triage,
│   │                             # weekly-report, word-form, bug-report, git-workflow 스킬
│   └── hooks/                    # 비밀 파일 읽기를 차단하는 Hook
├── .vscode/
│   └── settings.json             # 작업 영역 설정
├── docs/                         # 기준 문서(지식 베이스), 보고서 Word 양식
├── data/                         # 이슈 목록, 회의 메모 원본
├── private/                      # members.csv(팀원 명부, Hook 실습), secret.txt(샌드박스 실습)
├── scripts/                      # Word 양식 채우기, 검증 스크립트(판정, 보고서 스크립트는 실습에서 만듦)
├── tests/cases.json              # 검증셋(정상, 경계, 실패)
└── output/                       # 생성된 결과물
```

## 실행

판정, 보고서 스크립트를 만든 뒤(또는 `complete` 브랜치에서) 실행합니다.

```bash
node scripts/triage.js   # data/issues.csv 판정 -> output/triage-result.md, .csv
node scripts/report.js   # 판정 결과로 보고서 -> output/report-YYYY-MM-DD.md
node scripts/check.js    # 검증셋과 비교
node scripts/fill-docx.js docs/report-template.docx   # Word 양식의 칸 목록 보기
node scripts/fill-docx.js docs/report-template.docx output/weekly-report-2026-09-04.json   # 값 파일로 Word 파일 만들기
```

## 실습 순서

| 단계 | 내용 | 관련 파일 |
| --- | --- | --- |
| 1 | 팀 FAQ 비서 | `.github/skills/team-faq/` |
| 2 | 노트북 신청 양식 작성(Word 양식 채우기) | `.github/skills/laptop-request/`, `scripts/fill-docx.js` |
| 3 | 회의록 정리와 되묻기 | `.github/skills/meeting-notes/`, `data/meeting-2026-09-01.md`, 심화: `data/meeting-2026-09-08.md`, `docs/glossary.md` |
| 4 | 스펙 문서 질문과 출처 확인 | `docs/spec-ts100.md` |
| 5 | 버그 리포트 조사 계획 | `.github/skills/bug-report/` |
| 6 | 이슈 판정표 생성 | `scripts/triage.js`, `docs/issue-rules.md` |
| 7 | 보고서 자동 생성과 Word 양식 | `scripts/report.js`, `.github/skills/weekly-report/`, `.github/skills/word-form/`, `docs/report-template.docx` |
| 8 | 검증셋과 권한 | `scripts/check.js`, `tests/cases.json`, `.github/hooks/` |
| 9 | 통합과 적용안 | `docs/quality-checklist.md`, `docs/adoption-plan-template.md` |
| 10 | 팀 운영(원격 저장소, 풀, 커밋, 푸시) | `.github/skills/git-workflow/` |

채팅 뷰에서 `/`를 입력하면 스킬 목록이 표시됩니다.
`weekly-report`와 `bug-report`는 `/이름`으로 부를 때만 실행되는 스킬입니다.
