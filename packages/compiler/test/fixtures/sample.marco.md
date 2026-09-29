---
title: 3주차 · 물리보안·출입통제 IAM
course: 보안시스템 운영 및 활용
week: 3
date: 2026-09-29
presenter: 홍길동
theme: v20-violet
edition: instructor
duration: 20
refs:
  S13: { title: "ISO/IEC 27001:2022 A.7 Physical controls", url: "https://www.iso.org/standard/27001", kind: standard, note: "물리적 보안 통제 항목" }
  S14: { title: "NIST SP 800-116 Rev.1", url: "https://csrc.nist.gov/pubs/sp/800/116/r1/final" }
  L01: { title: "소방시설법 제16조", kind: law }
videos:
  dQw4w9WgXcQ: { title: "문틈·손잡이 우회 시연", start: "07:21", credit: "DEF CON 33" }
assets:
  diagram:
    path: assets/diagram.png
    title: 3선 방어 개념도
    credit: MARCO 예제
    alt: 외곽·로비·핵심구역 개념도
terms:
  IAM: Identity and Access Management 신원 및 접근 관리
  MFA: Multi-Factor Authentication 다중 요소 인증
---

# slide cover
group: 표지 · 도입
subtitle: 출입통제의 기술과 운영을 함께 다룬다
time: 2분 · 0:00 – 2:00
note: |
  [조작] 수업 시작 전 덱을 열고 [F] 키로 전체화면 전환.
  [대사] {{auto}} 출입통제의 기술과 운영을 함께 다룹니다.

# slide hero alert
tag: 도입
group: 표지 · 도입
title: 사원증이 유효하면, 들어가도 되는가?
question: 인증에 성공한 사람은 모두 들어가도 될까?

협력사 점검원의 카드는 정상이다. 하지만 **안전교육**이 어제 만료됐다. <script>alert(1)</script>

:::pills
- ok: 인증 성공
- warn: 교육 만료
- 동반 통과
:::

## note
[시간] 1.5분 · 2:00 – 3:30
[대사] {{p02-c000}} 카드는 정상인데 교육이 만료되었다면 어떻게 할까요?
[발문] 이 사람을 들여보내야 할까요? | 10초
[주목] @s-02-b2 오른쪽 경고 알약을 가리킨다.

# slide id=principle-chain
tag: 기본 원리
title: 카드 인식, 허용, 문 열림, 사람 통과는 다른 단계다
refs: [S13]

:::chain
01 | 자격 제시 | 카드를 리더에 댄다
02 | 인증 | 유효한 자격인지 확인
03 | 인가 | 이 구역·시간에 허용?
04 | 잠금 해제 | 전기정의 잠금을 푼다
:::

:::cards cols=2
- kicker: 허용됐지만 안 들어감
  title: 허용 신호 ≠ 실제 입실
  body: 인증 뒤 문을 열지 않을 수도 있다. 문센서와 통과 감지는 별도로 확인한다. IAM 기록만 보면 안 된다.
  icon: door-open
  tone: warn
- kicker: 카드 없이 잠금 해제
  title: 퇴실·소방·원격 개방
  body: 실내 퇴실 버튼, 화재 연동, 운영자 명령도 잠금을 해제할 수 있다. 이 문장은 일부러 예산을 넘기도록 길게 썼다. 카드 본문은 두 칸 배치에서 90자를 넘으면 린트가 알려 주어야 하며, 잘라내지 않고 그대로 보여 준다.
  icon: shield-check
:::

:::takeaway 핵심 구분
인증은 자격 확인, 인가는 허용 판단, 센서는 문과 사람의 **상태** 확인이다.
:::

## note
[대사] 카드가 읽혔다고 사람이 들어간 것은 아닙니다.
[주목] @principle-chain-b1 @principle-chain-b1-i2 두 번째 단계를 짚는다.
[전환] 다음 부에서 장비를 본다.

# slide divider no=01
title: 인증과 하드웨어
subtitle: 문 앞과 문 뒤를 함께 본다.

# slide
tag: 1부 · 구역 설계
title: 층 이름보다 보호 구역과 통과 경계를 먼저 정한다
refs: [S13, S14]

| 구역 예 | 확인할 대상 | 출입통제의 역할 |
|:--|:-:|--:|
| 외곽·주차장 | 차량과 탑승자 | 등록 차량 확인 |
| 1층 로비 | 직원·방문자 | 동반 통과 구분 |

:::table caption="표 2 · 핵심 구역"
| 구역 | 조건 |
|---|---|
| 서버실 | 승인·교육·MFA |
:::

:::compare left="스피드게이트" right="맨트랩"
작동 | 인증 후 통로를 연다 | 첫 문을 닫고 다음 문을 연다
통행 | 연속 통행에 적합 | 한 사람씩 확인
:::

# slide
tag: 1부 · 운영
title: 정전과 비상 상황에서 문은 어떻게 동작하는가
layout: wide

:::columns cols=2
:::col
- Fail-Safe는 전원이 끊기면 잠금을 푼다
- Fail-Secure는 외부 진입을 계속 막는다

:::callout warn 주의
UPS가 락에 전원을 계속 공급하면 건물 정전이 곧 락의 전원 상실은 아니다.
:::
:::
:::col
1. **전원 확인** 락 전원 방식을 먼저 확인한다
2. **피난 경로** 기계식 손잡이를 둔다

:::verdict drop
화재 신호가 왔는데 피난문이 잠겨 있으면 안 된다.
:::
:::
:::

# slide
tag: 1부 · 영상과 그림
title: 문·사람·운영의 빈틈을 영상과 그림으로 살펴본다

![3선 방어 개념도](assets/diagram.png "외곽·로비·핵심구역의 개념도")

:::image asset=diagram caption="확대해서 보는 개념도" zoom fit=contain height=400
:::

:::video id=dQw4w9WgXcQ start=441 label="문틈·손잡이 우회 시연" caption="DEF CON 33 · 07:21–12:17"
:::

> 좋은 보안은 사람이 지나가는 방식을 설계한다.
> — 강의 노트

# slide
tag: 1부 · 절차
title: 권한 회수는 기록과 현장 적용을 모두 확인한다

### 퇴사 처리의 네 단계

인사 종료 후 `revoke` 명령과 [공식 문서](https://csrc.nist.gov)로 확인한다.

```bash title="권한 회수 예"
pacs revoke --user 1042 --site hq
pacs verify --user 1042
```

:::steps
- title: 인사 종료
  body: 계약 종료일이 기준이 된다
- title: 권한 회수
  body: 허용 목록에서 제거한다
:::

:::timeline
09:00 | 퇴사 확정 | 인사 시스템 반영
09:10 | 권한 회수 | 서버에서 삭제
09:30 | 현장 확인 | 문에서 거부 확인
:::

# slide
tag: 1부 · 요약
title: 다중 인증과 용어를 정리한다

:::tiles cols=4
- icon: id-card
  label: 소유
  value: 카드
  tone: primary
- icon: key-round
  label: 지식
  value: PIN
- icon: fingerprint
  label: 생체
  value: 얼굴
- icon: no-such-icon-name
  label: 조합
  value: MFA
:::

:::terms
LPR | License Plate Recognition | 차량번호 인식
PIN | Personal Identification Number | 개인 식별 번호
:::

:::widget abac role=engineer level=3 strict
:::

:::html
<div class="custom-note">직접 쓴 HTML 조각</div>
:::

# slide quote
tag: 마무리
title: 문을 여는 기술보다 권한을 다루는 설계가 먼저다.
cite: 3주차 정리

# slide references
title: 참고 자료 · 공식 문서와 미디어

# slide raw
title: 직접 만든 슬라이드

<div class="slide-wrapper"><h2 class="section-title">직접 만든 HTML 슬라이드</h2></div>
