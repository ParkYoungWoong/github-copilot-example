---
name: issue-triage
description: 이슈 목록 전체를 판정하고 판정표를 만들 때 사용합니다. scripts/triage.js를 실행하고 미판정 건을 정리합니다.
---

# 이슈 목록 판정

`data/issues.csv`의 이슈를 `docs/issue-rules.md` 규칙대로 판정합니다.

## 순서

1. `docs/issue-rules.md`를 읽고 규칙이 바뀌지 않았는지 확인합니다.
1. 터미널에서 `node scripts/triage.js`를 실행합니다.
1. `output/triage-result.md`를 읽고 아래 내용을 요약해서 답합니다.
   - 전체 건수와 우선순위별 건수
   - 우선순위 높음 목록
   - 미판정 목록과 각각 접수자에게 무엇을 물어야 하는지
1. 사용자가 규칙 변경을 요청하면 `docs/issue-rules.md`와 `scripts/triage.js`의 키워드 목록을 함께 고칩니다.

## 규칙

- 스크립트 결과를 임의로 바꾸지 않습니다. 결과가 이상하면 규칙이나 데이터의 문제를 설명합니다.
- 판정 근거는 판정표의 근거 칸을 그대로 인용합니다.
