# GitHub Copilot 업무 비서 예제

VS Code와 GitHub Copilot으로 연구개발팀의 반복 업무를 맡기는 예제입니다.
가상의 온도 센서 모듈 TS-100을 만드는 팀을 배경으로, 팀 FAQ 답변, 노트북 신청 양식 작성, 회의록 정리, 이슈 판정, 보고서 생성을 다룹니다.

## 준비

- [VS Code](https://code.visualstudio.com/)와 [Node.js](https://nodejs.org/) 22 이상
- VS Code에서 GitHub 계정으로 로그인(Copilot Free 플랜으로도 실습할 수 있습니다)

외부 패키지를 사용하지 않으므로 별도의 설치 명령은 없습니다.

## 구조

```plaintext
.
├── .github/
│   ├── copilot-instructions.md   # 모든 요청에 적용되는 팀 규칙
│   ├── instructions/             # 특정 파일에만 적용되는 규칙
│   ├── agents/                   # 이슈 판정 전용 커스텀 에이전트
│   ├── skills/                   # team-faq, laptop-request, meeting-notes, issue-triage,
│   │                             # weekly-report, bug-report 스킬
│   └── hooks/                    # 비밀 파일 읽기를 차단하는 Hook
├── .vscode/
│   └── settings.json             # 작업 영역 설정
├── docs/                         # 기준 문서(지식 베이스)
├── data/                         # 이슈 목록, 회의 메모 원본
├── scripts/                      # 판정, 보고서, 검증 스크립트
├── tests/cases.json              # 검증셋(정상, 경계, 실패)
└── output/                       # 생성된 결과물
```

## 실행

```bash
node scripts/triage.js   # data/issues.csv 판정 -> output/triage-result.md, .csv
node scripts/report.js   # 판정 결과로 보고서 -> output/report.md
node scripts/check.js    # 검증셋과 비교
```

## 실습 순서

| 단계 | 내용 | 관련 파일 |
| --- | --- | --- |
| 1 | 팀 FAQ 비서 | `.github/skills/team-faq/` |
| 2 | 노트북 신청 양식 작성 | `.github/skills/laptop-request/` |
| 3 | 회의록 정리와 되묻기 | `.github/skills/meeting-notes/`, `data/meeting-2026-09-01.md` |
| 4 | 스펙 문서 질문과 출처 확인 | `docs/spec-ts100.md` |
| 5 | 버그 리포트 조사 계획 | `.github/skills/bug-report/` |
| 6 | 이슈 판정표 생성 | `scripts/triage.js`, `docs/issue-rules.md` |
| 7 | 보고서 자동 생성 | `scripts/report.js`, `.github/skills/weekly-report/` |
| 8 | 검증셋과 권한 | `scripts/check.js`, `tests/cases.json`, `.github/hooks/` |
| 9 | 통합과 적용안 | `docs/quality-checklist.md`, `docs/adoption-plan-template.md` |

채팅 뷰에서 `/`를 입력하면 스킬 목록이 표시됩니다.
`weekly-report`와 `bug-report`는 `/이름`으로 부를 때만 실행되는 스킬입니다.
