---
name: weekly-report
description: 판정표를 바탕으로 주간 보고서를 만듭니다
agent: agent
argument-hint: 보고 기간이나 강조할 내용
---

`output/triage-result.md` 판정표를 읽고 `docs/report-template.md` 형식 그대로 주간 보고서를 작성합니다.

- 보고 기간: ${input:period:이번 주}
- 결과 파일: `output/weekly-report.md`

작성 규칙:

- 템플릿의 제목 순서와 표 형식을 바꾸지 않습니다.
- 우선순위 높음 건은 담당을 `docs/issue-rules.md`의 담당자 배정 규칙대로 채웁니다.
- 미판정 건은 접수자에게 무엇을 다시 물어야 하는지 한 줄로 적습니다.
- 판정표에 없는 내용을 지어내지 않습니다.
