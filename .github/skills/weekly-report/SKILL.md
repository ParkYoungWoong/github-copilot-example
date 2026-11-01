---
name: weekly-report
description: 판정표를 바탕으로 주간 보고서를 만듭니다. 사용자가 /weekly-report로 부를 때만 사용합니다.
argument-hint: 보고 기간이나 강조할 내용
disable-model-invocation: true
---

# 주간 보고서 작성

`output/triage-result.md` 판정표를 읽고 `docs/report-template.md` 형식 그대로 주간 보고서를 작성합니다.

- 보고 기간: 명령 뒤에 적은 기간을 사용합니다. 없으면 이번 주로 합니다.
- 결과 파일: `output/weekly-report.md`

## 규칙

- 템플릿의 제목 순서와 표 형식을 바꾸지 않습니다.
- 우선순위 높음 건은 담당을 `docs/issue-rules.md`의 담당자 배정 규칙대로 채웁니다.
- 미판정 건은 접수자에게 무엇을 다시 물어야 하는지 한 줄로 적습니다.
- 판정표에 없는 내용을 지어내지 않습니다.
