---
title: 물리보안 · 출입통제 IAM
course: 보안시스템 운영 및 활용
week: 3
theme: v20-violet
refs:
  S03:
    title: NXP MIFARE Classic
    url: "https://www.nxp.com/products/rfid-nfc/mifare-hf/mifare-classic%3AMC_41863"
  S04:
    title: NIST PACS · PIV
    url: "https://csrc.nist.gov/pubs/sp/800/116/r1/final"
  S05:
    title: NIST 얼굴 PAD 평가
    url: "https://www.nist.gov/publications/face-analysis-technology-evaluation-fate-part-10-performance-passive-software-based"
  S06:
    title: NXP DESFire EV3
    url: "https://www.nxp.com/products/MF3DHx3"
  S07:
    title: NXP MIFARE Plus EV2
    url: "https://www.nxp.com/docs/en/data-sheet/MF1P(H)x2.pdf"
  S08:
    title: HID 모바일 기기 호환
    url: "https://www.hidglobal.com/mobile-access-compatible-devices"
  S09:
    title: CSA Aliro 1.0 발표
    url: "https://csa-iot.org/newsroom/introducing-aliro-1-0-a-unified-standard-to-transform-the-access-control-ecosystem/"
  S12:
    title: FIDO 사양
    url: "https://fidoalliance.org/specifications/"
  S13:
    title: Axis Secure Entry
    url: "https://help.axis.com/en-us/axis-camera-station-secure-entry"
  S16:
    title: Allegion Fail-Safe / Fail-Secure
    url: "https://us.allegion.com/en/resources/education/leading-the-industry/decoded/fail-safe-vs-fail-secure.html"
  S17:
    title: Allegion 지연 개방
    url: "https://idighardware.com/2026/06/decoded-delayed-egress-locks/"
  S18:
    title: 건축법 시행령 제40조
    url: "https://law.go.kr/lsLawLinkInfo.do?chrClsCd=010202&lsJoLnkSeq=1000991011"
  S19:
    title: RFC 7644 · SCIM
    url: "https://www.rfc-editor.org/rfc/rfc7644"
  S20:
    title: OpenID Connect
    url: "https://openid.net/specs/openid-connect-core-1_0.html"
  S22:
    title: Genetec APB
    url: "https://techdocs.genetec.com/r/en-US/Security-Center-Administrator-Guide-5.12/Applying-antipassback-to-areas"
  S23:
    title: Genetec 컨트롤러 기능
    url: "https://resources.genetec.com/i/917976-synergis-cloud-link"
  S24:
    title: NIST OT 보안
    url: "https://csrc.nist.gov/pubs/sp/800/82/r3/final"
  S26:
    title: 개인정보 보호법 시행령 제18조
    url: "https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0018&lsiSeq=286175&urlMode=lsScJoRltInfoR"
  S28:
    title: Genetec Mercury APB 제약
    url: "https://techdocs.genetec.com/r/en-US/SynergisTM-Softwire-Configuration-Guide-for-Genetec-Cloudlink-in-Security-Center-SaaS/Mercury-native-area-control-limitations?contentId=wOdAucDhw40zPMkYlBBaLg"
  S29:
    title: NIST RBAC
    url: "https://csrc.nist.gov/projects/role-based-access-control"
  S30:
    title: NIST ABAC
    url: "https://csrc.nist.gov/pubs/sp/800/162/upd2/final"
  S31:
    title: Microsoft PIM
    url: "https://learn.microsoft.com/en-us/entra/id-governance/privileged-identity-management/pim-configure"
  S32:
    title: Microsoft JEA
    url: "https://learn.microsoft.com/en-us/powershell/scripting/security/remoting/jea/overview?view=powershell-7.5"
  S33:
    title: NIST RBAC FAQ
    url: "https://csrc.nist.gov/projects/role-based-access-control/faqs"
  S34:
    title: Microsoft 권한 재검토
    url: "https://learn.microsoft.com/en-us/entra/id-governance/access-reviews-overview"
  S35:
    title: Palo Alto PAM
    url: "https://www.paloaltonetworks.com/cyberpedia/what-is-privileged-access-management"
  S36:
    title: NIST 최소 권한
    url: "https://csrc.nist.gov/glossary/term/least_privilege"
  B01:
    title: NIST FMR 정의
    url: "https://csrc.nist.gov/glossary/term/false_match_rate"
  B02:
    title: NIST FNMR 정의
    url: "https://csrc.nist.gov/glossary/term/false_non_match_rate"
  B03:
    title: "NIST FRTE 1:N · FPIR와 FNIR"
    url: "https://pages.nist.gov/frvt/html/frvt1N.html"
  W01:
    title: SPARROWS · 문 하부 접근 도구
    url: "https://www.sparrowslockpicks.com/products/the-stretcher-under-door-tool"
  W02:
    title: Bosch DS160/DS161 · 퇴실 센서 데이터시트
    url: "https://cdn.commerce.boschsecurity.com/public/documents/DS160_DS161_Data_sheet_enUS_9007201890365835.pdf"
  W03:
    title: Allegion Ives · 래치 보호판
    url: "https://allegion.ca/en/products/brands/ives/lock-guards.html"
  W04:
    title: Von Duprin 98/99 · 피난 장치
    url: "https://www.vonduprin.com/content/dam/allegion-us-2/web-files/von-duprin-/information-documents/Von_Duprin_98_99_Infographic_116491.pdf"
  W06:
    title: Boon Edam · Speedlane Compact
    url: "https://www.boonedam.com/products/speed-gates/speedlane-compact"
  W07:
    title: Boon Edam · Circlelock Solo
    url: "https://www.boonedam.com/products/mantrap-security-doors-and-portals/circlelock-solo"
  W08:
    title: Allegion · 정전 시 잠금 상태와 피난
    url: "https://us.allegion.com/en/resources/education/leading-the-industry/decoded/fail-safe-vs-fail-secure.html"
  L01:
    title: 소방시설법 제16조
    url: "https://www.law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1025643243"
  L02:
    title: 산업기술보호법 제10조
    url: "https://www.law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1030229711"
  A04:
    title: 개인정보 보호법 시행령 · 생체정보 범위
    url: "https://www.law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1034050143"
  A05:
    title: RFC 8446 · TLS 1.3
    url: "https://www.rfc-editor.org/rfc/rfc8446"
  C01:
    title: EM Microelectronic EM4200 · 번호형 LF 카드
    url: "https://www.emmicroelectronic.com/product/lf-animal-access-ics/em4200"
  C02:
    title: A Practical Attack on the MIFARE Classic · 2008
    url: "https://arxiv.org/abs/0803.2285"
  C03:
    title: NXP AN10969 · MIFARE 시스템 보안과 키 관리
    url: "https://www.nxp.com/docs/en/application-note/AN10969.pdf"
videos:
  tTAISQqmxWQ:
    title: DEF CON 33 - Intro to Physical Security Bypass - Karen Ng, Matthew Cancilla
    start: 441
    credit: DEFCONConference · Karen Ng, Matthew Cancilla
  DNP_fHTMy84:
    title: DEF CON 33 - How NOT to Perform Covert Entry Assessments - Brent White, Tim Roberts
    start: 1631
    credit: DEFCONConference · Brent White, Tim Roberts
  wd74Pnwd-50:
    title: What it takes to protect and break into data centers with Deviant Ollam
    start: 3589
    credit: Random but Memorable · 1Password · Deviant Ollam
assets:
  campus:
    path: assets/campus.png
    title: 사옥의 3선 방어 개념도
    credit: imagegen 생성 · 건물 관계를 설명하는 축약 개념도.
    alt: 사옥의 외곽·로비·핵심구역 개념도
  architecture:
    path: assets/architecture.png
    title: 출입통제 구성요소 개념도
    credit: imagegen 생성 · 연결선은 실제 배선도가 아님.
    alt: 출입통제 구성요소 생성 개념도 · 실제 배선도가 아님
  iam:
    path: assets/iam.png
    title: RBAC · ABAC · JIT · SoD 개념도
    credit: imagegen 생성 · 정책 요소의 비교를 위한 그림.
    alt: 역할·조건·기간·독립 승인의 생성 개념도
  speedgate:
    path: assets/speedgate.png
    title: Boon Edam Speedlane Compact
    credit: 제품 사진 · © Boon Edam.
    source: "https://www.boonedam.com/products/speed-gates/speedlane-compact"
    alt: 스피드게이트 · Speedlane Compact
  circlelock:
    path: assets/circlelock.png
    title: Boon Edam Circlelock Solo
    credit: 제품 사진 · © Boon Edam.
    source: "https://www.boonedam.com/products/mantrap-security-doors-and-portals/circlelock-solo"
    alt: 맨트랩 · Circlelock Solo
  biostation-hero:
    path: assets/biostation-hero.png
    title: Suprema BioStation 3
    credit: 제품 사진 · © Suprema.
    source: "https://www.supremainc.com/en/hardware/new-door-access-experience-biostation3.asp"
    alt: Suprema BioStation 3 · 제품 사진
  video-bypass:
    path: assets/video-bypass.jpg
    title: Intro to Physical Security Bypass · 영상 썸네일
    credit: 영상 썸네일 · DEFCONConference.
    source: "https://www.youtube.com/watch?v=tTAISQqmxWQ"
  video-assessment:
    path: assets/video-assessment.jpg
    title: How NOT to Perform Covert Entry Assessments · 영상 썸네일
    credit: 영상 썸네일 · DEFCONConference.
    source: "https://www.youtube.com/watch?v=DNP_fHTMy84"
  video-datacenter:
    path: assets/video-datacenter.jpg
    title: What it takes to protect and break into data centers · 영상 썸네일
    credit: 영상 썸네일 · Random but Memorable.
    source: "https://www.youtube.com/watch?v=wd74Pnwd-50"
  udt:
    path: assets/udt.jpg
    title: Under-Door Tool · 문 하부 접근 도구
    credit: 제품 사진 · SPARROWS Lock Picks
    source: "https://www.sparrowslockpicks.com/products/the-stretcher-under-door-tool"
    alt: 문 하부 접근 도구
  rex-sensor:
    path: assets/rex-sensor.jpg
    title: Bosch DS160/DS161 · 퇴실 요청 센서
    credit: 제품 사진 · SourceSecurity / Bosch DS160
    source: "https://www.sourcesecurity.com/bosch-ds-160-technical-details.html"
    alt: 퇴실 요청 센서
  latch-guard:
    path: assets/latch-guard.jpg
    title: Ives 래치 보호판 · 제품 예시
    credit: 제품 사진 · Allegion / Ives
    source: "https://allegion.ca/en/products/brands/ives/lock-guards.html"
    alt: 래치 보호판
  panic-bar:
    path: assets/panic-bar.png
    title: Von Duprin 99 · 패닉바형 피난 장치
    credit: 제품 사진 · National Lock Supply / Von Duprin
    source: "https://nationallocksupply.com/von-duprin-rxqel99eo-rim-exit-device-w-electric-latch-retraction-request-to-exit/"
    alt: 패닉바
terms:
  IAM: Identity and Access Management 신원 및 접근 관리
  LPR: License Plate Recognition 차량번호 인식
  UVIS: Under Vehicle Inspection System 차량 하부 검사 시스템
  Aliro: CSA의 모바일 출입 상호운용 규격 제품의 지원 버전·인증 범위를 확인한다.
  CSA: Connectivity Standards Alliance 연결 표준 연합
  MFA: Multi-Factor Authentication 다중 요소 인증
  PIN: Personal Identification Number 개인 식별 번호 · 사용자가 아는 비밀
  HR: Human Resources 인사 정보
  PACS: Physical Access Control System 물리 출입통제 시스템
  SoD: Separation of Duties 직무분리
  JEA: Just Enough Administration 필요한 관리 작업만 허용하는 범위 제한
  JML: Joiner · Mover · Leaver 입사·이동·퇴사/계약 종료
  APB: Anti-Passback 정상 퇴실 없는 재입실 등 출입 순서의 모순을 제한
  SLA: Service Level Agreement 서비스 수준 합의 · 여기서는 회수 반영 목표 시간 등의 기준
---

# slide cover id=cover
title: 문을 여는 기술, *권한을 다루는 설계.*
toc: 물리보안 · 출입통제 IAM
subtitle: 장비가 어떻게 문을 제어하는지 이해하고, 누가 언제 들어갈 수 있는지 설계한다.
tagline: PHYSICAL ACCESS × IDENTITY
meta: [중앙대학교 산업보안학과, Curriculum v3 · V20]
art: campus
tag: 표지
group: 표지 · 도입

:::pills
- 인증 · 통신 · 피난 · 권한
- 본문으로 이해하는 출입통제
:::

## note
[대사] 출입통제의 기술과 운영을 함께 다룬다. IAM은 Identity and Access Management, 신원 및 접근 관리다. 누구인지 확인하는 인증과 무엇을 허용할지 판단하는 인가를 구분한다.

# slide id=intro
title: 사원증이 유효하면, 들어가도 되는가?
tag: 도입
refs: [S04, S30]

### 협력사 점검원의 카드는 정상이다. 하지만 안전교육이 어제 만료됐다.

:::cards cols=3
- kicker: 인증
  title: 누구의 자격인가
  body: 카드나 생체정보가 해당 사람의 유효한 자격인지 확인한다.
- kicker: 인가
  title: 지금 이 문을 열어도 되는가
  body: 역할·교육·작업 승인·시간 조건을 판단한다.
- kicker: 통과
  title: 실제로 누가 지나갔는가
  body: 문 열림과 통과 인원을 확인한다. 인증한 사람이 문을 잡아주면 다른 사람도 따라갈 수 있다.
:::

:::takeaway 이 경우의 판단
카드 인증이 성공해도 교육 유효 조건을 만족하지 않으면 해당 구역 출입을 거부한다.
:::

## note
[대사] @intro-b1 협력사 점검원의 카드는 정상이다. 하지만 안전교육이 어제 만료됐다.
[대사] @intro-b2-i1 인증 누구의 자격인가 카드나 생체정보가 해당 사람의 유효한 자격인지 확인한다.
[대사] @intro-b2-i2 인가 지금 이 문을 열어도 되는가 역할·교육·작업 승인·시간 조건을 판단한다.
[대사] @intro-b2-i3 통과 실제로 누가 지나갔는가 문 열림과 통과 인원을 확인한다. 인증한 사람이 문을 잡아주면 다른 사람도 따라갈 수 있다.
[대사] @intro-b3 이 경우의 판단 카드 인증이 성공해도 교육 유효 조건을 만족하지 않으면 해당 구역 출입을 거부한다.

# slide id=four-questions
title: 출입통제는 네 가지 질문으로 이해한다
tag: 학습 안내

:::cards cols=4
- kicker: 01 · 인증
  title: 누구인가
  body: 카드·생체·모바일 자격과 서로 다른 인증 요소의 조합을 이해한다.
- kicker: 02 · 장비
  title: 무엇이 문을 여는가
  body: 리더, 컨트롤러, 전기정, 문센서가 각각 하는 일을 연결한다.
- kicker: 03 · 피난
  title: 전원이 끊기면 어떻게 되는가
  body: 잠금 해제와 기계식 탈출, 방화문 닫힘을 구분한다.
- kicker: 04 · 권한
  title: 언제까지 무엇을 허용하는가
  body: 역할·현재 조건·활성 기간·독립 승인으로 접근 범위를 정한다.
:::

:::terms
IAM | Identity and Access Management | 신원 및 접근 관리
:::

:::takeaway 수업의 목표
각 개념을 장비 동작과 실제 출입 허용·거부의 예로 설명한다.
:::

## note
[대사] @four-questions-b1-i1 01 · 인증 누구인가 카드·생체·모바일 자격과 서로 다른 인증 요소의 조합을 이해한다.
[대사] @four-questions-b1-i2 02 · 장비 무엇이 문을 여는가 리더, 컨트롤러, 전기정, 문센서가 각각 하는 일을 연결한다.
[대사] @four-questions-b1-i3 03 · 피난 전원이 끊기면 어떻게 되는가 잠금 해제와 기계식 탈출, 방화문 닫힘을 구분한다.
[대사] @four-questions-b1-i4 04 · 권한 언제까지 무엇을 허용하는가 역할·현재 조건·활성 기간·독립 승인으로 접근 범위를 정한다.
[대사] @four-questions-b2 IAM Identity and Access Management 신원 및 접근 관리
[대사] @four-questions-b3 수업의 목표 각 개념을 장비 동작과 실제 출입 허용·거부의 예로 설명한다.

# slide id=principle-chain
title: 카드 인식, 허용, 문 열림, 사람 통과는 다른 단계다
tag: 기본 원리
refs: [S13]

:::chain
01 | 자격 제시 | 카드를 리더에 댄다
02 | 인증 | 유효한 자격인지 확인
03 | 인가 | 이 구역·시간에 허용?
04 | 잠금 해제 | 전기정의 잠금을 푼다
05 | 실제 통과 | 센서로 통과를 확인
:::

:::cards cols=2
- kicker: 허용됐지만 안 들어감
  title: 허용 신호 ≠ 실제 입실
  body: 인증 뒤 문을 열지 않을 수도 있다. 문센서와 통과 감지는 별도로 확인한다.
- kicker: 카드 없이 잠금 해제
  title: 퇴실·소방·원격 개방
  body: 실내 퇴실 버튼, 화재 연동, 운영자 명령도 잠금을 해제할 수 있다.
:::

:::takeaway 핵심 구분
인증은 자격 확인, 인가는 허용 판단, 센서는 문과 사람의 상태 확인이다.
:::

## note
[대사] @principle-chain-b1 01 자격 제시 카드를 리더에 댄다 02 인증 유효한 자격인지 확인 03 인가 이 구역·시간에 허용? 04 잠금 해제 전기정의 잠금을 푼다 05 실제 통과 센서로 통과를 확인
[대사] @principle-chain-b2-i1 허용됐지만 안 들어감 허용 신호 ≠ 실제 입실 인증 뒤 문을 열지 않을 수도 있다. 문센서와 통과 감지는 별도로 확인한다.
[대사] @principle-chain-b2-i2 카드 없이 잠금 해제 퇴실·소방·원격 개방 실내 퇴실 버튼, 화재 연동, 운영자 명령도 잠금을 해제할 수 있다.
[대사] @principle-chain-b3 핵심 구분 인증은 자격 확인, 인가는 허용 판단, 센서는 문과 사람의 상태 확인이다.

# slide divider dark id=part-1
title: 문 앞과 문 뒤를 함께 본다.
toc: 인증과 하드웨어
subtitle: 외곽에서 핵심구역까지, 자격·장비·통신의 역할을 연결한다.
kicker: 보안시스템 운영 및 활용 · 3주차
tag: 1부
group: 1부 · 인증과 하드웨어
no: "01"

## note
[대사] 01 보안시스템 운영 및 활용 · 3주차 문 앞과 문 뒤를 함께 본다. 외곽에서 핵심구역까지, 자격·장비·통신의 역할을 연결한다.

# slide
title: 외곽 → 로비 → 핵심구역
tag: 1부 · 3선 방어
group: 1부 · 인증과 하드웨어

:::columns cols=2
:::col
:::image asset=campus caption="외곽·로비·핵심구역의 생성 개념도" zoom
:::
:::
:::col
- **제1선 · 외곽 · 사람과 차량의 접근** 펜스·볼라드·차량 차단기로 접근 경로를 정하고 번호판과 탑승자를 확인한다.
- **제2선 · 로비 · 등록과 통과 인원** 방문 등록, 스피드게이트, 승강기 층별 제어로 건물 안의 이동을 관리한다.
- **제3선 · 핵심구역 · 자산 단위의 권한** 서버실·연구실은 별도 권한과 추가 인증을 적용한다. 필요한 경우 맨트랩·랙 잠금을 둔다.
:::
:::

:::terms
LPR | License Plate Recognition | 차량번호 인식
UVIS | Under Vehicle Inspection System | 차량 하부 검사 시스템
:::

## note
[대사] @s-06-b1-i1-b1 이미지 확대 ↗ 외곽·로비·핵심구역의 생성 개념도
[대사] @s-06-b1-i2-b1 제1선 · 외곽 사람과 차량의 접근 펜스·볼라드·차량 차단기로 접근 경로를 정하고 번호판과 탑승자를 확인한다. 제2선 · 로비 등록과 통과 인원 방문 등록, 스피드게이트, 승강기 층별 제어로 건물 안의 이동을 관리한다. 제3선 · 핵심구역 자산 단위의 권한 서버실·연구실은 별도 권한과 추가 인증을 적용한다. 필요한 경우 맨트랩·랙 잠금을 둔다.
[대사] @s-06-b2 LPR License Plate Recognition 차량번호 인식 UVIS Under Vehicle Inspection System 차량 하부 검사 시스템

# slide
title: 층 이름보다 보호 구역과 통과 경계를 먼저 정한다
tag: 1부 · 구역 설계
group: 1부 · 인증과 하드웨어

| 구역 예 | 확인할 대상 | 출입통제의 역할 |
|---|---|---|
| 외곽·주차장 | 차량과 탑승자 | 등록 차량이라도 탑승자 신원 확인은 별도다. |
| 1층 로비 | 직원·방문자 | 정상 인증과 동반 통과를 구분한다. |
| 일반 사무구역 | 소속과 업무 | 소속 구역과 필요한 업무 경로만 허용한다. |
| 서버실·연구실 | 중요 자산 접근 | 업무 승인·교육·추가 인증·시간 조건을 적용한다. |
| 비상계단·피난문 | 안전한 탈출 | 외부 진입 통제와 내부 피난 방법을 함께 설계한다. |

:::takeaway 설계 예
“5층 전체 허용”보다 “5층 서버실 점검, 승인된 시간, 동행자 필요”처럼 자원·행위·조건을 명확히 쓴다.
:::

## note
[대사] @s-07-b1 구역 예 확인할 대상 출입통제의 역할 외곽·주차장 차량과 탑승자 등록 차량이라도 탑승자 신원 확인은 별도다. 1층 로비 직원·방문자 정상 인증과 동반 통과를 구분한다. 일반 사무구역 소속과 업무 소속 구역과 필요한 업무 경로만 허용한다. 서버실·연구실 중요 자산 접근 업무 승인·교육·추가 인증·시간 조건을 적용한다. 비상계단·피난문 안전한 탈출 외부 진입 통제와 내부 피난 방법을 함께 설계한다.
[대사] @s-07-b2 설계 예 “5층 전체 허용”보다 “5층 서버실 점검, 승인된 시간, 동행자 필요”처럼 자원·행위·조건을 명확히 쓴다.

# slide
title: 탐지 후 남은 지연 시간이 대응 시간보다 길어야 한다
tag: 1부 · 대응 시간
group: 1부 · 인증과 하드웨어

### 경보를 확인하고 현장에 도착하기 전에 중요 자산에 도달한다면 방어가 늦다.

:::html
<div class="timing-demo"><div class="metric-form"><label>최초 탐지 후 남은 지연 <output id="delay-value"></output><input id="delay-range" type="range" min="1" max="30" value="12"></label><label>경보 확인·출동·현장 도착 <output id="response-value"></output><input id="response-range" type="range" min="1" max="30" value="8"></label></div><div class="timing-result" id="timing-result" aria-live="polite"></div></div>
:::

:::takeaway 같은 시작점으로 비교
12분 지연 − 8분 대응 = 4분 여유. 탐지 전에 이미 통과한 담장의 시간은 다시 더하지 않는다.
:::

위 수치는 원리를 설명하기 위한 예다. 실제 시간은 탐지 위치·우회 경로·출동 인력을 기준으로 측정한다.

## note
[대사] @s-08-b1 경보를 확인하고 현장에 도착하기 전에 중요 자산에 도달한다면 방어가 늦다.
[대사] @s-08-b2 최초 탐지 후 남은 지연 경보 확인·출동·현장 도착
[대사] @s-08-b3 같은 시작점으로 비교 12분 지연 − 8분 대응 = 4분 여유. 탐지 전에 이미 통과한 담장의 시간은 다시 더하지 않는다.
[대사] @s-08-b4 위 수치는 원리를 설명하기 위한 예다. 실제 시간은 탐지 위치·우회 경로·출동 인력을 기준으로 측정한다.

# slide
title: 문틈·래치·퇴실센서도 출입통제의 일부다
tag: 1부 · 설치 취약점
group: 1부 · 인증과 하드웨어
refs: [W01, W02, W03, W04]

:::columns cols=2
:::col
:::image asset=udt zoom height=215
:::

**문 하부 접근 도구** · Under-Door Tool 문 아래 틈을 통한 실내 손잡이 접근 가능성을 보여준다. **점검 · 하부 틈과 차폐 구조를 확인한다.**
:::
:::col
:::image asset=rex-sensor zoom height=215
:::

**퇴실 요청 센서** · REX · Request-to-Exit 실내 사람이 나가려는 움직임을 감지해 퇴실 신호를 보낸다. **점검 · 외부 자극·감지 방향·잠금 해제 설정을 확인한다.**
:::
:::

:::columns cols=2
:::col
:::image asset=latch-guard zoom height=215
:::

**래치 보호판** · Latch Guard 문과 문틀 사이의 래치 부위를 가려 외부 접근을 줄인다. **점검 · 래치 맞물림·문틀 정렬·보호판 틈을 확인한다.**
:::
:::col
:::image asset=panic-bar zoom height=215
:::

**패닉바** · Panic Exit Device 실내에서 바를 밀면 기계적으로 래치를 해제하는 피난 장치다. **점검 · 외부에서 닿는 틈을 줄이고 실내 피난은 유지한다.**
:::
:::

:::takeaway 사진을 눌러 확대
도구·센서·보호판·패닉바의 모양을 비교한다. 설치 상태가 다르면 같은 장비라도 효과가 달라진다.
:::

## note
[대사] @s-09-b1-i1-b1 이미지 확대 ↗ 문 하부 접근 도구
[대사] @s-09-b1-i1-b2 문 하부 접근 도구 Under-Door Tool 문 아래 틈을 통한 실내 손잡이 접근 가능성을 보여준다. 점검 · 하부 틈과 차폐 구조를 확인한다.
[대사] @s-09-b1-i2-b1 이미지 확대 ↗ 퇴실 요청 센서
[대사] @s-09-b1-i2-b2 퇴실 요청 센서 REX · Request-to-Exit 실내 사람이 나가려는 움직임을 감지해 퇴실 신호를 보낸다. 점검 · 외부 자극·감지 방향·잠금 해제 설정을 확인한다.
[대사] @s-09-b2-i1-b1 이미지 확대 ↗ 래치 보호판
[대사] @s-09-b2-i1-b2 래치 보호판 Latch Guard 문과 문틀 사이의 래치 부위를 가려 외부 접근을 줄인다. 점검 · 래치 맞물림·문틀 정렬·보호판 틈을 확인한다.
[대사] @s-09-b2-i2-b1 이미지 확대 ↗ 패닉바
[대사] @s-09-b2-i2-b2 패닉바 Panic Exit Device 실내에서 바를 밀면 기계적으로 래치를 해제하는 피난 장치다. 점검 · 외부에서 닿는 틈을 줄이고 실내 피난은 유지한다.
[대사] @s-09-b3 사진을 눌러 확대 도구·센서·보호판·패닉바의 모양을 비교한다. 설치 상태가 다르면 같은 장비라도 효과가 달라진다.

# slide
title: 문·사람·운영의 빈틈을 영상으로 살펴본다
tag: 1부 · 최근 물리 침투 테스트 영상
group: 1부 · 인증과 하드웨어

:::columns cols=3
:::col
:::video id=tTAISQqmxWQ start=441 label="문틈·손잡이 우회 시연" caption="Intro to Physical Security Bypass"
:::

공식 강연 · 게시 2025-10-10 · DEF CON 33 Karen Ng · Matthew Cancilla · 07:21–12:17 · 4분 56초

래치 보호판과 손잡이 우회 시연을 본다. 문틈·설치 상태·내부 손잡이를 함께 점검해야 하는 이유를 살핀다.
:::
:::col
:::video id=DNP_fHTMy84 start=1631 label="출입카드 복제 사례" caption="How NOT to Perform Covert Entry Assessments"
:::

공식 강연 · 게시 2025-10-10 · DEF CON 33 Brent White · Tim Roberts · 27:11–32:27 · 5분 16초

컵·클립보드를 이용한 출입카드 사례를 본다. 복제 가능성은 카드 종류와 암호 방식에 따라 다름을 함께 확인한다.
:::
:::col
:::video id=wd74Pnwd-50 start=3589 label="데이터센터의 경보 대응" caption="What it takes to protect and break into data centers"
:::

전문가 인터뷰 · 게시 2026-03-31 · Random but Memorable · 1Password Deviant Ollam 인터뷰 · 59:49–1:04:51 · 5분 2초

경비 인력이 한 사람에게 집중된 사이 다른 구역이 노출된 사례를 듣는다. 경보 확인·초소 유지·대응 분담을 짚는다.
:::
:::

각 영상의 핵심 구간 약 5분 · 총 15분 14초. 허가된 물리 침투 테스트 사례를 보고 방어 관점을 짚는다. 클릭 후 재생하며 인터넷이 필요하다.

## note
[대사] @s-10-b1-i1-b1 ▶ 공식 강연 · 게시 2025-10-10 문틈·손잡이 우회 시연 Intro to Physical Security Bypass DEF CON 33 Karen Ng · Matthew Cancilla 07:21–12:17 · 4분 56초
[대사] @s-10-b1-i1-b3 래치 보호판과 손잡이 우회 시연을 본다. 문틈·설치 상태·내부 손잡이를 함께 점검해야 하는 이유를 살핀다. ▶ 07:21부터 재생 ▶
[대사] @s-10-b1-i2-b1 공식 강연 · 게시 2025-10-10 출입카드 복제 사례 How NOT to Perform Covert Entry Assessments DEF CON 33 Brent White · Tim Roberts 27:11–32:27 · 5분 16초
[대사] @s-10-b1-i2-b3 컵·클립보드를 이용한 출입카드 사례를 본다. 복제 가능성은 카드 종류와 암호 방식에 따라 다름을 함께 확인한다. ▶ 27:11부터 재생 ▶
[대사] @s-10-b1-i3-b1 전문가 인터뷰 · 게시 2026-03-31 데이터센터의 경보 대응 What it takes to protect and break into data centers Random but Memorable · 1Password Deviant Ollam 인터뷰 59:49–1:04:51 · 5분 2초
[대사] @s-10-b1-i3-b3 경비 인력이 한 사람에게 집중된 사이 다른 구역이 노출된 사례를 듣는다. 경보 확인·초소 유지·대응 분담을 짚는다. ▶ 59:49부터 재생
[대사] @s-10-b2 각 영상의 핵심 구간 약 5분 · 총 15분 14초. 허가된 물리 침투 테스트 사례를 보고 방어 관점을 짚는다. 클릭 후 재생하며 인터넷이 필요하다.

# slide
title: 어떤 출입카드가 더 안전할까?
tag: 1부 · 카드
group: 1부 · 인증과 하드웨어
refs: [S03, S06, S07, C01, C02, C03]

:::cards cols=2
- title: 번호만 확인 — “등록된 번호인가?”
  body: 카드가 보낸 번호를 허용 목록과 비교한다. 같은 번호를 흉내 내면 원본과 구별하기 어렵다.
- title: 암호로 확인 — “비밀키를 갖고 있는가?”
  body: 카드와 리더가 비밀키를 이용해 서로 확인한다. 번호만 복사해서는 같은 인증을 통과하기 어렵다.
:::

| 카드 유형 | 보안 관점의 선택 | 어떤 점이 문제인가? |
|---|---|---|
| **125 kHz 번호형 카드** EM4100 / 4200 계열 · LF | 복제 방어에 약함 | 식별 번호를 전송하는 방식이다. **번호만 대조하면 카드의 진위를 확인하기 어렵다.** |
| **MIFARE Classic** 13.56 MHz · HF | 신규 보안용 비권장 | 구형 Crypto-1 암호에 알려진 취약점이 있다. **주파수가 높아도 복제 위험이 사라지지 않는다.** |
| **MIFARE Plus EV2** 기존 Classic 환경의 전환에 활용 | SL3 사용 시 권장 | SL3는 AES 인증과 보호 통신을 적용한다. **구형 호환 모드(SL1)·혼용 설정을 확인해야 한다.** |
| **DESFire EV2 / EV3** 13.56 MHz · HF | AES 인증 사용 시 권장 | 카드와 리더가 AES로 서로 진위를 확인한다. **고급 카드라도 UID만 읽는 설정이면 이점을 잃는다.** |

:::callout info 선정 기준
DESFire EV2/EV3의 AES 인증, 또는 Plus EV2의 SL3를 지원하는 카드·리더 구성을 검토한다.
:::

:::callout info 공통 약점
분실·대여·키 유출 위험은 남는다. 카드별 키 분리·교체, 분실 카드 회수와 사용자 본인 확인도 필요하다.
:::

**RFID** Radio-Frequency Identification · 무선 식별 **UID** Unique Identifier · 카드 고유 번호

**LF / HF** Low Frequency / High Frequency · 저주파 / 고주파 이 표의 MIFARE 3종은 모두 13.56 MHz다.

**AES** Advanced Encryption Standard · 대칭키 암호 **128** 키 길이(비트) · **SL** Security Level · 보안 수준

## note
[대사] @s-11-b1-i1 번호만 확인 — “등록된 번호인가?” 카드가 보낸 번호를 허용 목록과 비교한다. 같은 번호를 흉내 내면 원본과 구별하기 어렵다.
[대사] @s-11-b1-i2 암호로 확인 — “비밀키를 갖고 있는가?” 카드와 리더가 비밀키를 이용해 서로 확인한다. 번호만 복사해서는 같은 인증을 통과하기 어렵다.
[대사] @s-11-b2 카드 유형 보안 관점의 선택 어떤 점이 문제인가? 125 kHz 번호형 카드 EM4100 / 4200 계열 · LF 복제 방어에 약함 식별 번호를 전송하는 방식이다. 번호만 대조하면 카드의 진위를 확인하기 어렵다. MIFARE Classic 13.56 MHz · HF 신규 보안용 비권장 구형 Crypto-1 암호에 알려진 취약점이 있다. 주파수가 높아도 복제 위험이 사라지지 않는다. MIFARE Plus EV2 기존 Classic 환경의 전환에 활용 SL3 사용 시 권장 SL3는 AES 인증과 보호 통신을 적용한다. 구형 호환 모드(SL1)·혼용 설정을 확인해야 한다. DESFire EV2 / EV3 13.56 MHz · HF AES 인증 사용 시 권장 카드와 리더가 AES로 서로 진위를 확인한다. 고급 카드라도 UID만 읽는 설정이면 이점을 잃는다.
[대사] @s-11-b3 선정 기준 DESFire EV2/EV3의 AES 인증, 또는 Plus EV2의 SL3를 지원하는 카드·리더 구성을 검토한다.
[대사] @s-11-b4 공통 약점 분실·대여·키 유출 위험은 남는다. 카드별 키 분리·교체, 분실 카드 회수와 사용자 본인 확인도 필요하다.
[대사] @s-11-b5 RFID Radio-Frequency Identification · 무선 식별 UID Unique Identifier · 카드 고유 번호
[대사] @s-11-b6 LF / HF Low Frequency / High Frequency · 저주파 / 고주파 이 표의 MIFARE 3종은 모두 13.56 MHz다.
[대사] @s-11-b7 AES Advanced Encryption Standard · 대칭키 암호 128 키 길이(비트) · SL Security Level · 보안 수준

# slide
title: NFC·BLE·UWB는 접촉 거리와 사용 방식이 다르다
tag: 1부 · 모바일 자격
group: 1부 · 인증과 하드웨어
refs: [S08, S09]

:::cards cols=3
- kicker: NFC · Near Field Communication
  title: 가까이 대어 사용
  body: 근거리 무선통신. 휴대전화를 리더 가까이에 대어 자격을 제시한다.
- kicker: BLE · Bluetooth Low Energy
  title: 근처에서 연결
  body: 저전력 블루투스. 휴대전화와 리더가 무선으로 연결되며 사용자 확인 방식은 제품마다 다르다.
- kicker: UWB · Ultra-Wideband
  title: 거리 확인에 활용
  body: 초광대역 무선. 지원 기기·리더에서 거리 측정을 활용해 핸즈프리 접근 조건을 판단한다.
:::

:::takeaway 기기 분실 때
휴대전화 잠금만 믿지 않고 모바일 출입 자격을 회수한다. 새 기기 발급과 이전 기기 폐기를 함께 처리한다.
:::

:::terms
Aliro | CSA의 모바일 출입 상호운용 규격 | 제품의 지원 버전·인증 범위를 확인한다.
CSA | Connectivity Standards Alliance | 연결 표준 연합
:::

## note
[대사] @s-12-b1-i1 NFC · Near Field Communication 가까이 대어 사용 근거리 무선통신. 휴대전화를 리더 가까이에 대어 자격을 제시한다.
[대사] @s-12-b1-i2 BLE · Bluetooth Low Energy 근처에서 연결 저전력 블루투스. 휴대전화와 리더가 무선으로 연결되며 사용자 확인 방식은 제품마다 다르다.
[대사] @s-12-b1-i3 UWB · Ultra-Wideband 거리 확인에 활용 초광대역 무선. 지원 기기·리더에서 거리 측정을 활용해 핸즈프리 접근 조건을 판단한다.
[대사] @s-12-b2 기기 분실 때 휴대전화 잠금만 믿지 않고 모바일 출입 자격을 회수한다. 새 기기 발급과 이전 기기 폐기를 함께 처리한다.
[대사] @s-12-b3 Aliro CSA의 모바일 출입 상호운용 규격 제품의 지원 버전·인증 범위를 확인한다. CSA Connectivity Standards Alliance 연결 표준 연합

# slide
title: 잘못된 일치와 불일치, 잘못된 식별과 미식별
tag: 1부 · 생체인식
group: 1부 · 인증과 하드웨어
refs: [B01, B02, B03, S05]

:::columns cols=2
:::col
:::image asset=biostation-hero caption="Suprema BioStation 3 · 제품 사진" zoom
:::
:::
:::col
### 1:1 검증 — “본인이 맞는가?”

카드로 특정한 한 사람의 등록 정보와 현재 얼굴·지문을 비교한다.

### 1:N 식별 — “등록된 사람 중 누구인가?”

등록자 N명의 목록에서 현재 사람과 맞는 후보를 찾는다.
:::
:::

| 범위 | 약어와 전체 이름 | 어떤 오류인가? |
|---|---|---|
| 1:1 | **FMR** · False Match Rate | 타인의 생체정보를 본인과 같다고 판단한 비율. → 잘못된 허용 위험. |
| 1:1 | **FNMR** · False Non-Match Rate | 본인의 생체정보를 다르다고 판단한 비율. → 정상 사용자 거부. |
| 1:N | **FPIR** · False Positive Identification Rate | 등록되지 않은 사람을 등록자 중 누군가로 잘못 찾은 검색 비율. |
| 1:N | **FNIR** · False Negative Identification Rate | 등록자가 있는데 정답을 기준 점수 이상으로 찾지 못한 검색 비율. |

:::takeaway PAD · Presentation Attack Detection
사진·영상·가면 같은 가짜 제시를 탐지하는 기능. 정확도 지표와 별도로 평가한다.
:::

오식별률의 표기는 FPIR이다. 결과는 기준 점수(임계값), 등록 인원 N, 조명·각도·평가 조건과 함께 읽는다.

## note
[대사] @s-13-b1-i1-b1 이미지 확대 ↗ Suprema BioStation 3 · 제품 사진
[대사] @s-13-b1-i2-b1 1:1 검증 — “본인이 맞는가?”
[대사] @s-13-b1-i2-b2 카드로 특정한 한 사람의 등록 정보와 현재 얼굴·지문을 비교한다.
[대사] @s-13-b1-i2-b3 1:N 식별 — “등록된 사람 중 누구인가?”
[대사] @s-13-b1-i2-b4 등록자 N명의 목록에서 현재 사람과 맞는 후보를 찾는다.
[대사] @s-13-b2 범위 약어와 전체 이름 어떤 오류인가? 1:1 FMR · False Match Rate 타인의 생체정보를 본인과 같다고 판단한 비율. → 잘못된 허용 위험. 1:1 FNMR · False Non-Match Rate 본인의 생체정보를 다르다고 판단한 비율. → 정상 사용자 거부. 1:N FPIR · False Positive Identification Rate 등록되지 않은 사람을 등록자 중 누군가로 잘못 찾은 검색 비율. 1:N FNIR · False Negative Identification Rate 등록자가 있는데 정답을 기준 점수 이상으로 찾지 못한 검색 비율.
[대사] @s-13-b3 PAD · Presentation Attack Detection 사진·영상·가면 같은 가짜 제시를 탐지하는 기능. 정확도 지표와 별도로 평가한다.
[대사] @s-13-b4 오식별률의 표기는 FPIR이다. 결과는 기준 점수(임계값), 등록 인원 N, 조명·각도·평가 조건과 함께 읽는다.

# slide
title: 서로 다른 요소를 함께 확인하면 도용 위험을 줄인다
tag: 1부 · 다중 인증
group: 1부 · 인증과 하드웨어
refs: [S04, S12]

:::terms
MFA | Multi-Factor Authentication | 다중 요소 인증
PIN | Personal Identification Number | 개인 식별 번호 · 사용자가 아는 비밀
:::

:::cards cols=3
- kicker: 소유
  title: 카드·모바일 자격
  body: 내가 가진 것을 확인한다. 분실·대여·복제 위험이 있다.
- kicker: 지식
  title: 개인 PIN
  body: 내가 아는 비밀을 확인한다. 노출·공유를 관리한다.
- kicker: 생체
  title: 얼굴·지문
  body: 신체 특징을 확인한다. 오인식과 가짜 제시를 함께 평가한다.
:::

:::html
<div class="demo-strip"><span>카드 + PIN 조합</span><label><input type="checkbox" id="mfa-card" checked> 카드 확인</label><label><input type="checkbox" id="mfa-pin"> PIN 확인</label><strong id="mfa-result" aria-live="polite"></strong></div>
:::

:::takeaway 두 번 확인 ≠ 두 요소
카드 두 장은 모두 소유 요소다. MFA 후에도 출입 권한 판단과 동반 통과 감시는 필요하다.
:::

## note
[대사] @s-14-b1 MFA Multi-Factor Authentication 다중 요소 인증 PIN Personal Identification Number 개인 식별 번호 · 사용자가 아는 비밀
[대사] @s-14-b2-i1 소유 카드·모바일 자격 내가 가진 것을 확인한다. 분실·대여·복제 위험이 있다.
[대사] @s-14-b2-i2 지식 개인 PIN 내가 아는 비밀을 확인한다. 노출·공유를 관리한다.
[대사] @s-14-b2-i3 생체 얼굴·지문 신체 특징을 확인한다. 오인식과 가짜 제시를 함께 평가한다.
[대사] @s-14-b3 카드 + PIN 조합 카드 확인 PIN 확인
[대사] @s-14-b4 두 번 확인 ≠ 두 요소 카드 두 장은 모두 소유 요소다. MFA 후에도 출입 권한 판단과 동반 통과 감시는 필요하다.

# slide
title: 사람의 정보가 실제 문 제어로 바뀌는 경로
tag: 1부 · 전체 아키텍처
group: 1부 · 인증과 하드웨어
refs: [S19, S20, S24]

:::columns cols=2
:::col
:::image asset=architecture caption="출입통제 구성요소 생성 개념도 · 실제 배선도가 아님" zoom
:::
:::
:::col
:::steps
- title: 인사·계약 정보
  body: 재직·소속·계약 종료일이 신원의 기준이 된다.
- title: 신원·권한 관리
  body: 역할·작업 승인·허용 구역·유효기간을 정한다.
- title: 출입통제 서버 → 컨트롤러
  body: 허용 목록과 정책을 전달하고 현장에서 인증·인가를 집행한다.
- title: 리더 → 전기정 → 센서
  body: 자격을 읽고, 허용 시 잠금을 풀며, 문 열림과 통과 상태를 확인한다.
:::
:::
:::

:::terms
HR | Human Resources | 인사 정보
IAM | Identity and Access Management | 신원 및 접근 관리
PACS | Physical Access Control System | 물리 출입통제 시스템
:::

:::takeaway 퇴사 예
인사 종료 → 출입 권한 회수 → 컨트롤러 적용 확인. 서버 화면에서 삭제한 것과 현장 문에서 거부되는 것은 구분한다.
:::

## note
[대사] @s-15-b1-i1-b1 이미지 확대 ↗ 출입통제 구성요소 생성 개념도 · 실제 배선도가 아님 1
[대사] @s-15-b1-i2-b1-i1 인사·계약 정보 재직·소속·계약 종료일이 신원의 기준이 된다. 2
[대사] @s-15-b1-i2-b1-i2 신원·권한 관리 역할·작업 승인·허용 구역·유효기간을 정한다. 3
[대사] @s-15-b1-i2-b1-i3 출입통제 서버 → 컨트롤러 허용 목록과 정책을 전달하고 현장에서 인증·인가를 집행한다. 4
[대사] @s-15-b1-i2-b1-i4 리더 → 전기정 → 센서 자격을 읽고, 허용 시 잠금을 풀며, 문 열림과 통과 상태를 확인한다.
[대사] @s-15-b2 HR Human Resources 인사 정보 IAM Identity and Access Management 신원 및 접근 관리 PACS Physical Access Control System 물리 출입통제 시스템
[대사] @s-15-b3 퇴사 예 인사 종료 → 출입 권한 회수 → 컨트롤러 적용 확인. 서버 화면에서 삭제한 것과 현장 문에서 거부되는 것은 구분한다.

# slide
title: 스피드게이트는 통행 흐름, 맨트랩은 두 문 사이를 통제한다
tag: 1부 · 통과 장비
group: 1부 · 인증과 하드웨어
refs: [W06, W07]

:::columns cols=2
:::col
:::image asset=speedgate caption="스피드게이트 · Speedlane Compact" zoom
:::
:::
:::col
:::image asset=circlelock caption="맨트랩 · Circlelock Solo" zoom
:::
:::
:::

| 비교 | 스피드게이트 | 맨트랩 · 이중 인터락 출입구 |
|---|---|---|
| 작동 | 인증 후 통로를 열고 센서로 사람의 통과를 감지한다. | 첫 문을 닫고 내부 조건을 확인한 뒤 다음 문을 연다. |
| 통행 방식 | 직원이 연속적으로 지나가는 로비에 적합하다. | 한 사람씩 확인하는 고보안 구역에 적합하다. |
| 통제 초점 | 인증 수와 통과 인원의 차이·동반 통과 탐지. | 두 문 동시 개방 제한과 내부 인원·인증 조건 확인. |
| 고려할 점 | 통행량·넓은 통로·안전 센서·경보 대응. | 통과 지연·휠체어/운반물·비상 해제·구조 절차. |

:::takeaway 인터락(Interlock)
한 문이 열려 있을 때 다른 문을 제한하는 상호 잠금이다. 두 장비 모두 끼임 방지와 승인된 비상 피난 기능이 필요하다.
:::

## note
[대사] @s-16-b1-i1-b1 이미지 확대 ↗ 스피드게이트 · Speedlane Compact
[대사] @s-16-b1-i2-b1 이미지 확대 ↗ 맨트랩 · Circlelock Solo
[대사] @s-16-b2 비교 스피드게이트 맨트랩 · 이중 인터락 출입구 작동 인증 후 통로를 열고 센서로 사람의 통과를 감지한다. 첫 문을 닫고 내부 조건을 확인한 뒤 다음 문을 연다. 통행 방식 직원이 연속적으로 지나가는 로비에 적합하다. 한 사람씩 확인하는 고보안 구역에 적합하다. 통제 초점 인증 수와 통과 인원의 차이·동반 통과 탐지. 두 문 동시 개방 제한과 내부 인원·인증 조건 확인. 고려할 점 통행량·넓은 통로·안전 센서·경보 대응. 통과 지연·휠체어/운반물·비상 해제·구조 절차.
[대사] @s-16-b3 인터락(Interlock) 한 문이 열려 있을 때 다른 문을 제한하는 상호 잠금이다. 두 장비 모두 끼임 방지와 승인된 비상 피난 기능이 필요하다.

# slide divider dark id=part-2
title: 들어오는 권한과 나가는 안전.
toc: 안전과 권한
subtitle: 업무에 필요한 접근만 허용하고, 내부 사람의 피난 경로를 보장한다.
kicker: 보안시스템 운영 및 활용 · 3주차
tag: 2부
group: 2부 · 안전과 권한
no: "02"

## note
[대사] 02 보안시스템 운영 및 활용 · 3주차 들어오는 권한과 나가는 안전. 업무에 필요한 접근만 허용하고, 내부 사람의 피난 경로를 보장한다.

# slide
title: 밖에서의 무단 진입을 막고, 안에서는 안전하게 나가게 한다
tag: 2부 · 법령과 설계
group: 2부 · 안전과 권한
refs: [L01, L02]

:::cards cols=2
- kicker: 피난시설 보호
  title: 소방시설법 제16조
  body: 피난시설·방화구획·방화시설을 정당한 사유 없이 폐쇄·훼손하거나 장애물을 두는 행위를 제한한다.
- kicker: 기술 보호
  title: 산업기술보호법 제10조
  body: 국가핵심기술을 보유·관리하는 대상기관에 보호구역 설정, 출입허가 또는 출입 시 휴대품 검사 등의 조치를 요구한다.
:::

### 출입문 설계에 적용하면

:::steps
- title: 외부에서는 승인된 사람만 들어가게 한다.
- title: 실내에서는 정해진 피난 경로로 탈출할 수 있게 한다.
- title: 방화문은 연기·화염 확산을 막도록 닫힘·래치 기능도 유지한다.
:::

:::takeaway 적용 범위
모든 서버실이 국가핵심기술 보호구역인 것은 아니다. 시설 용도·문 위치·피난 요구에 맞는 잠금과 소방 연동을 정한다.
:::

## note
[대사] @s-18-b1-i1 피난시설 보호 소방시설법 제16조 피난시설·방화구획·방화시설을 정당한 사유 없이 폐쇄·훼손하거나 장애물을 두는 행위를 제한한다.
[대사] @s-18-b1-i2 기술 보호 산업기술보호법 제10조 국가핵심기술을 보유·관리하는 대상기관에 보호구역 설정, 출입허가 또는 출입 시 휴대품 검사 등의 조치를 요구한다.
[대사] @s-18-b2 출입문 설계에 적용하면
[대사] @s-18-b3-i1 외부에서는 승인된 사람만 들어가게 한다.
[대사] @s-18-b3-i2 실내에서는 정해진 피난 경로로 탈출할 수 있게 한다.
[대사] @s-18-b3-i3 방화문은 연기·화염 확산을 막도록 닫힘·래치 기능도 유지한다.
[대사] @s-18-b4 적용 범위 모든 서버실이 국가핵심기술 보호구역인 것은 아니다. 시설 용도·문 위치·피난 요구에 맞는 잠금과 소방 연동을 정한다.

# slide
title: Fail-Safe는 잠금 해제, Fail-Secure는 잠금 유지
tag: 2부 · 정전과 잠금
group: 2부 · 안전과 권한
refs: [S16, W08]

:::html
<div class="power-control"><label><input id="lock-power" type="checkbox" checked> 잠금장치에 전원 공급</label><span>체크를 끄면 잠금장치 전원이 끊긴 상태다.</span></div>
:::

:::cards cols=2
- kicker: Fail-Safe · 비통전 해제형
  title: 전기가 끊기면 잠금을 풀어 준다.
  body: 전기로 붙잡던 잠금이 풀려 사람이 밀거나 당겨 열 수 있는 상태가 된다. 전자석 잠금장치가 대표적인 예다. Power-to-Lock · 전원을 넣어 잠근다.
- kicker: Fail-Secure · 비통전 잠금형
  title: 전기가 끊겨도 외부 진입은 막는다.
  body: 전원 상실 때 외부 접근 측 잠금이 유지된다. 내부는 별도의 기계식 손잡이·패닉바로 나갈 수 있게 구성할 수 있다. Power-to-Unlock · 전원을 넣어 잠금을 푼다.
:::

:::takeaway “문이 열린다”의 정확한 뜻
잠금 해제는 문을 열 수 있게 되는 것이다. 문짝이 자동으로 벌어지는 뜻은 아니다. 안전한 피난은 락·손잡이·소방 회로를 함께 설계해야 한다.
:::

위 표시는 락 전원만 비교하는 단순 모델이다. UPS가 락에 전원을 계속 공급하면 건물 정전이 곧 락의 전원 상실은 아니다.

## note
[대사] @s-19-b1 잠금장치에 전원 공급 체크를 끄면 잠금장치 전원이 끊긴 상태다.
[대사] @s-19-b2-i1 Fail-Safe · 비통전 해제형 전기가 끊기면 잠금을 풀어 준다. 전기로 붙잡던 잠금이 풀려 사람이 밀거나 당겨 열 수 있는 상태가 된다. 전자석 잠금장치가 대표적인 예다. Power-to-Lock · 전원을 넣어 잠근다.
[대사] @s-19-b2-i2 Fail-Secure · 비통전 잠금형 전기가 끊겨도 외부 진입은 막는다. 전원 상실 때 외부 접근 측 잠금이 유지된다. 내부는 별도의 기계식 손잡이·패닉바로 나갈 수 있게 구성할 수 있다. Power-to-Unlock · 전원을 넣어 잠금을 푼다.
[대사] @s-19-b3 “문이 열린다”의 정확한 뜻 잠금 해제는 문을 열 수 있게 되는 것이다. 문짝이 자동으로 벌어지는 뜻은 아니다. 안전한 피난은 락·손잡이·소방 회로를 함께 설계해야 한다.
[대사] @s-19-b4 위 표시는 락 전원만 비교하는 단순 모델이다. UPS가 락에 전원을 계속 공급하면 건물 정전이 곧 락의 전원 상실은 아니다.

# slide
title: 피난할 수 있는 문과 방화 기능을 함께 유지한다
tag: 2부 · 피난과 화재 연동
group: 2부 · 안전과 권한
refs: [S16, S17, S18, L01]

:::cards cols=3
- kicker: 사람이 나갈 때
  title: 패닉바·손잡이를 밀거나 돌림
  body: 실내에서 기계적으로 래치를 해제하는 구성은 외부 잠금과 별개로 피난을 지원한다.
- kicker: 화재 신호가 들어올 때
  title: 승인된 문별 연동으로 동작
  body: 해당 문에 필요한 잠금 해제·경보·방화 기능이 실제 회로에서 동작하도록 한다.
- kicker: 사람이 지나간 뒤
  title: 문 닫힘과 래치를 확인
  body: 방화문을 계속 열어 두면 연기와 화염이 퍼질 수 있다. 피난과 방화구획 기능을 동시에 본다.
:::

:::takeaway 지연 개방 · Delayed Egress
일부 용도에서 정해진 조건으로 문 해제를 지연하는 방식이다. 해외의 15초·30초 수치를 국내 모든 비상문에 일괄 적용하지 않는다.
:::

:::takeaway 오경보를 줄일 때도
보안 목적의 임의 이중 감지 조건으로 필수 피난 해제를 지연하지 않는다. 시설 기준과 승인된 소방 연동표를 따른다.
:::

## note
[대사] @s-20-b1-i1 사람이 나갈 때 패닉바·손잡이를 밀거나 돌림 실내에서 기계적으로 래치를 해제하는 구성은 외부 잠금과 별개로 피난을 지원한다.
[대사] @s-20-b1-i2 화재 신호가 들어올 때 승인된 문별 연동으로 동작 해당 문에 필요한 잠금 해제·경보·방화 기능이 실제 회로에서 동작하도록 한다.
[대사] @s-20-b1-i3 사람이 지나간 뒤 문 닫힘과 래치를 확인 방화문을 계속 열어 두면 연기와 화염이 퍼질 수 있다. 피난과 방화구획 기능을 동시에 본다.
[대사] @s-20-b2 지연 개방 · Delayed Egress 일부 용도에서 정해진 조건으로 문 해제를 지연하는 방식이다. 해외의 15초·30초 수치를 국내 모든 비상문에 일괄 적용하지 않는다.
[대사] @s-20-b3 오경보를 줄일 때도 보안 목적의 임의 이중 감지 조건으로 필수 피난 해제를 지연하지 않는다. 시설 기준과 승인된 소방 연동표를 따른다.

# slide
title: 사람, 계정, 출입증, 암호키는 같은 것이 아니다
tag: 2부 · 신원과 자격
group: 2부 · 안전과 권한
refs: [S04, S19, S26]

:::cards cols=4
- kicker: Identity · 신원
  title: 사람의 기준 정보
  body: 누구인지, 어느 부서인지, 재직·계약 상태가 어떤지 관리한다. 한 사람에게 여러 자격을 연결할 수 있다.
- kicker: Account · 계정
  title: 시스템에 로그인하는 수단
  body: 보안 콘솔·방문자 시스템 등의 계정이다. 계정을 껐다고 모든 출입증이 자동 회수되는 것은 아니다.
- kicker: Credential · 자격
  title: 문 앞에서 제시하는 수단
  body: 카드·모바일 출입증·생체 템플릿 등이다. 재발급할 때 이전 자격의 유효성도 끊어야 한다.
- kicker: Crypto Key · 암호키
  title: 진위를 확인하는 비밀 값
  body: 카드 인증과 통신 보호에 사용한다. 카드 번호와 구분하고 노출·공유·교체를 관리한다.
:::

:::takeaway 퇴사·계약 종료
로그인 계정 비활성화 → 출입 자격 회수 → 컨트롤러 반영 확인. 필요한 경우 암호키 영향도 따로 검토한다.
:::

생체 템플릿은 비교에 사용하는 특징 정보다. 일반 비밀번호의 단순 해시와 같은 것으로 취급하지 않는다.

## note
[대사] @s-21-b1-i1 Identity · 신원 사람의 기준 정보 누구인지, 어느 부서인지, 재직·계약 상태가 어떤지 관리한다. 한 사람에게 여러 자격을 연결할 수 있다.
[대사] @s-21-b1-i2 Account · 계정 시스템에 로그인하는 수단 보안 콘솔·방문자 시스템 등의 계정이다. 계정을 껐다고 모든 출입증이 자동 회수되는 것은 아니다.
[대사] @s-21-b1-i3 Credential · 자격 문 앞에서 제시하는 수단 카드·모바일 출입증·생체 템플릿 등이다. 재발급할 때 이전 자격의 유효성도 끊어야 한다.
[대사] @s-21-b1-i4 Crypto Key · 암호키 진위를 확인하는 비밀 값 카드 인증과 통신 보호에 사용한다. 카드 번호와 구분하고 노출·공유·교체를 관리한다.
[대사] @s-21-b2 퇴사·계약 종료 로그인 계정 비활성화 → 출입 자격 회수 → 컨트롤러 반영 확인. 필요한 경우 암호키 영향도 따로 검토한다.
[대사] @s-21-b3 생체 템플릿은 비교에 사용하는 특징 정보다. 일반 비밀번호의 단순 해시와 같은 것으로 취급하지 않는다.

# slide
title: RBAC·ABAC·JIT·SoD는 서로 다른 질문에 답한다
tag: 2부 · 권한 결합
group: 2부 · 안전과 권한
refs: [S29, S30, S31, S33]

:::image asset=iam caption="역할·조건·기간·독립 승인의 생성 개념도" zoom
:::

:::cards cols=4
- kicker: RBAC · Role-Based Access Control
  title: 역할 기반 접근통제
  body: 이 직무에 필요한 구역인가?
- kicker: ABAC · Attribute-Based Access Control
  title: 속성 기반 접근통제
  body: 지금 계약·교육·작업 조건을 만족하는가?
- kicker: JIT · Just-In-Time
  title: 필요한 시점의 일시 권한
  body: 승인받은 시간에만 활성화됐는가?
- kicker: SoD · Separation of Duties
  title: 직무분리
  body: 신청과 승인을 다른 사람이 했는가?
:::

:::takeaway 같이 적용하는 예
유지보수 역할 + 유효한 교육 + 14~16시 작업 승인 + 독립 승인자 → 해당 서버실 접근을 허용한다.
:::

## note
[대사] @s-22-b1 이미지 확대 ↗ 역할·조건·기간·독립 승인의 생성 개념도
[대사] @s-22-b2-i1 RBAC Role-Based Access Control 역할 기반 접근통제 이 직무에 필요한 구역인가?
[대사] @s-22-b2-i2 ABAC Attribute-Based Access Control 속성 기반 접근통제 지금 계약·교육·작업 조건을 만족하는가?
[대사] @s-22-b2-i3 JIT Just-In-Time 필요한 시점의 일시 권한 승인받은 시간에만 활성화됐는가?
[대사] @s-22-b2-i4 SoD Separation of Duties 직무분리 신청과 승인을 다른 사람이 했는가?
[대사] @s-22-b3 같이 적용하는 예 유지보수 역할 + 유효한 교육 + 14~16시 작업 승인 + 독립 승인자 → 해당 서버실 접근을 허용한다.

# slide
title: 역할에 권한을 묶고, 사용자에게 그 역할을 부여한다
tag: 2부 · RBAC
group: 2부 · 안전과 권한
refs: [S29, S33, S36]

### **RBAC · Role-Based Access Control** — 역할 기반 접근통제.

| 역할 예 | 로비 | 일반 사무구역 | 서버실 | 관리 행위 |
|---|---|---|---|---|
| 일반 임직원 | 허용 | 소속 구역 | 기본 거부 | 없음 |
| 서버 유지보수 | 허용 | 필요한 작업 경로 | 작업 승인·시간 조건부 | 없음 |
| 경비 당직자 | 허용 | 순찰 구역 | 비상 절차에 따라 별도 | 원격 개방 권한 별도 |
| 권한 승인자 | 본인 업무 범위 | 본인 업무 범위 | 필요 시 별도 부여 | 타인의 요청 승인 |

:::cards cols=3
- kicker: 최소 권한
  title: 직무에 필요한 범위만
  body: 관리자라는 이유만으로 모든 문을 열 수 있게 하지 않는다.
- kicker: 역할 변경
  title: 옛 역할을 함께 회수
  body: 부서 이동 때 새 역할만 추가하면 이전 권한이 누적된다.
- kicker: 역할이 겹치면
  title: 제품의 합성 규칙 확인
  body: 상속·중복·충돌과 명시적 거부의 우선순위를 확인한다.
:::

## note
[대사] @s-23-b1 RBAC · Role-Based Access Control — 역할 기반 접근통제.
[대사] @s-23-b2 역할 예 로비 일반 사무구역 서버실 관리 행위 일반 임직원 허용 소속 구역 기본 거부 없음 서버 유지보수 허용 필요한 작업 경로 작업 승인·시간 조건부 없음 경비 당직자 허용 순찰 구역 비상 절차에 따라 별도 원격 개방 권한 별도 권한 승인자 본인 업무 범위 본인 업무 범위 필요 시 별도 부여 타인의 요청 승인
[대사] @s-23-b3-i1 최소 권한 직무에 필요한 범위만 관리자라는 이유만으로 모든 문을 열 수 있게 하지 않는다.
[대사] @s-23-b3-i2 역할 변경 옛 역할을 함께 회수 부서 이동 때 새 역할만 추가하면 이전 권한이 누적된다.
[대사] @s-23-b3-i3 역할이 겹치면 제품의 합성 규칙 확인 상속·중복·충돌과 명시적 거부의 우선순위를 확인한다.

# slide
title: 같은 역할이어도 현재 조건에 따라 허용 여부가 달라진다
tag: 2부 · ABAC
group: 2부 · 안전과 권한
refs: [S30]

### **ABAC · Attribute-Based Access Control** — 사람·대상·행위·환경의 속성을 평가한다.

:::html
<div class="split"><div class="attribute-form"><label><input class="abac-input" id="abac-contract" type="checkbox" checked><b>사람</b>협력사 계약 유효</label><label><input class="abac-input" id="abac-training" type="checkbox" checked><b>사람</b>안전교육 유효</label><label><input class="abac-input" id="abac-resource" type="checkbox" checked><b>대상·행위</b>승인된 서버실 출입</label><label><input class="abac-input" id="abac-work" type="checkbox" checked><b>환경</b>작업 승인·시간 조건 충족</label></div><div class="outcome-panel" id="abac-outcome" aria-live="polite"></div></div>
:::

:::takeaway 화면에서 바꿔 보기
안전교육 체크를 끄면 같은 카드·같은 역할이어도 이 예시 정책은 출입을 거부한다.
:::

네 조건을 모두 만족해야 하는 예시다. 속성의 갱신 시각, 조회 실패와 컨트롤러 캐시 동작도 정해야 한다.

## note
[대사] @s-24-b1 ABAC · Attribute-Based Access Control — 사람·대상·행위·환경의 속성을 평가한다.
[대사] @s-24-b2 사람 협력사 계약 유효 사람 안전교육 유효 대상·행위 승인된 서버실 출입 환경 작업 승인·시간 조건 충족
[대사] @s-24-b3 화면에서 바꿔 보기 안전교육 체크를 끄면 같은 카드·같은 역할이어도 이 예시 정책은 출입을 거부한다.
[대사] @s-24-b4 네 조건을 모두 만족해야 하는 예시다. 속성의 갱신 시각, 조회 실패와 컨트롤러 캐시 동작도 정해야 한다.

# slide
title: 필요할 때 승인받고, 정해진 시간이 끝나면 회수한다
tag: 2부 · JIT
group: 2부 · 안전과 권한
refs: [S31]

### **JIT · Just-In-Time** — 상시 권한을 줄이고 필요한 기간에만 권한을 활성화한다.

:::html
<div class="jit-track"><div data-jit-step="0"><span>1</span><b>신청 가능</b></div><div data-jit-step="1"><span>2</span><b>승인 대기</b></div><div data-jit-step="2"><span>3</span><b>기간 중 활성</b></div><div data-jit-step="3"><span>4</span><b>중앙 만료</b></div><div data-jit-step="4"><span>5</span><b>현장 회수 확인</b></div></div>
:::

:::html
<div class="demo-strip"><button class="action" id="jit-next">다음 단계</button><button class="action secondary" id="jit-reset">처음부터</button><label><input type="checkbox" id="jit-offline">컨트롤러 통신 중단</label></div>
:::

:::html
<div class="outcome-panel horizontal" id="jit-outcome" aria-live="polite"></div>
:::

:::takeaway 예 · 서버 점검 14:00~16:00
신청 자격이 있다는 것과 지금 출입 권한이 활성화됐다는 것은 다르다. 만료는 신규 입실 권한을 끝내는 것이며 내부 사람을 가두는 기능이 아니다.
:::

통신이 끊겨도 로컬 만료 기능이 있는 장비는 자체 시계로 거부할 수 있다. 중앙 회수 명령의 반영 여부와 구분한다.

## note
[대사] @s-25-b1 JIT · Just-In-Time — 상시 권한을 줄이고 필요한 기간에만 권한을 활성화한다.
[대사] @s-25-b2 1 신청 가능 2 승인 대기 3 기간 중 활성 4 중앙 만료 5 현장 회수 확인
[대사] @s-25-b3 다음 단계 처음부터 컨트롤러 통신 중단
[대사] @s-25-b5 예 · 서버 점검 14:00~16:00 신청 자격이 있다는 것과 지금 출입 권한이 활성화됐다는 것은 다르다. 만료는 신규 입실 권한을 끝내는 것이며 내부 사람을 가두는 기능이 아니다.
[대사] @s-25-b6 통신이 끊겨도 로컬 만료 기능이 있는 장비는 자체 시계로 거부할 수 있다. 중앙 회수 명령의 반영 여부와 구분한다.

# slide
title: 한 사람이 신청·승인·실행·감사를 모두 맡지 않게 한다
tag: 2부 · 직무분리
group: 2부 · 안전과 권한
refs: [S32, S33, S36]

:::terms
SoD | Separation of Duties | 직무분리
JEA | Just Enough Administration | 필요한 관리 작업만 허용하는 범위 제한
:::

:::cards cols=3
- kicker: 신청과 승인
  title: 자기 승인 금지
  body: 필요한 구역·시간을 신청하면 다른 책임자가 필요성과 조건을 확인한다.
- kicker: 실행 권한
  title: 작업 범위만 부여
  body: 설정 변경·전체 문 개방·기록 삭제를 한 계정에 모두 몰아주지 않는다.
- kicker: 사후 확인
  title: 독립적인 검토
  body: 비상 개방·권한 확대·예외 처리를 다른 담당자가 확인한다.
:::

:::html
<div class="demo-strip"><span>승인 예시</span><label><input type="checkbox" id="sod-same">신청자와 승인자가 같은 사람</label><strong id="sod-result" aria-live="polite">독립 승인 가능</strong></div>
:::

:::takeaway 정적 분리와 동적 분리
정적 분리는 충돌 역할의 동시 보유를 제한한다. 동적 분리는 보유한 역할이라도 같은 거래·세션에서 함께 사용하는 것을 제한한다.
:::

JEA는 Microsoft 관리 기술의 명칭이다. 물리 출입에서는 필요한 관리 범위만 부여한다는 원칙으로 연결한다.

## note
[대사] @s-26-b1 SoD Separation of Duties 직무분리 JEA Just Enough Administration 필요한 관리 작업만 허용하는 범위 제한
[대사] @s-26-b2-i1 신청과 승인 자기 승인 금지 필요한 구역·시간을 신청하면 다른 책임자가 필요성과 조건을 확인한다.
[대사] @s-26-b2-i2 실행 권한 작업 범위만 부여 설정 변경·전체 문 개방·기록 삭제를 한 계정에 모두 몰아주지 않는다.
[대사] @s-26-b2-i3 사후 확인 독립적인 검토 비상 개방·권한 확대·예외 처리를 다른 담당자가 확인한다.
[대사] @s-26-b3 승인 예시 신청자와 승인자가 같은 사람 독립 승인 가능
[대사] @s-26-b4 정적 분리와 동적 분리 정적 분리는 충돌 역할의 동시 보유를 제한한다. 동적 분리는 보유한 역할이라도 같은 거래·세션에서 함께 사용하는 것을 제한한다.
[대사] @s-26-b5 JEA는 Microsoft 관리 기술의 명칭이다. 물리 출입에서는 필요한 관리 범위만 부여한다는 원칙으로 연결한다.

# slide
title: 입사·이동·종료에 맞춰 권한을 계속 정리한다
tag: 2부 · 권한 생애주기
group: 2부 · 안전과 권한
refs: [S19, S31, S34, S35]

:::terms
JML | Joiner · Mover · Leaver | 입사·이동·퇴사/계약 종료
:::

:::chain
01 | 등록 | 본인·소속 확인
02 | 발급 | 역할·출입증 연결
03 | 변경 | 부서·업무 변경
04 | 재검토 | 과다·미사용 권한
05 | 회수 | 종료·분실·만료
:::

| 범주 · 전체 이름 | 무엇을 관리하는가? | 물리 출입에 연결하면 |
|---|---|---|
| **IGA** · Identity Governance and Administration | 신원·권한의 신청·승인·재검토 | 누가 어떤 권한을 왜 보유하는지 확인. |
| **PIM** · Privileged Identity Management | 특권 역할의 활성 기간·승인 | 운영자의 임시 관리자 역할 활성화. |
| **PAM** · Privileged Access Management | 특권 계정·비밀·접속 세션 | 출입통제 서버의 관리자 접속과 작업 관리. |

:::takeaway 회수까지가 한 과정
이전 부서·종료된 프로젝트의 권한을 남기지 않는다. 재검토에서 회수한 권한이 현장에 반영됐는지 확인한다.
:::

## note
[대사] @s-27-b1 JML Joiner · Mover · Leaver 입사·이동·퇴사/계약 종료
[대사] @s-27-b2 01 등록 본인·소속 확인 02 발급 역할·출입증 연결 03 변경 부서·업무 변경 04 재검토 과다·미사용 권한 05 회수 종료·분실·만료
[대사] @s-27-b3 범주 · 전체 이름 무엇을 관리하는가? 물리 출입에 연결하면 IGA · Identity Governance and Administration 신원·권한의 신청·승인·재검토 누가 어떤 권한을 왜 보유하는지 확인. PIM · Privileged Identity Management 특권 역할의 활성 기간·승인 운영자의 임시 관리자 역할 활성화. PAM · Privileged Access Management 특권 계정·비밀·접속 세션 출입통제 서버의 관리자 접속과 작업 관리.
[대사] @s-27-b4 회수까지가 한 과정 이전 부서·종료된 프로젝트의 권한을 남기지 않는다. 재검토에서 회수한 권한이 현장에 반영됐는지 확인한다.

# slide
title: 두 사람의 참여, 방문자 동행, 최초 입실과 시간표
tag: 2부 · 참여·시간 조건
group: 2부 · 안전과 권한
refs: [S22, S23]

:::cards cols=4
- kicker: Two-Person Rule · 두 사람 규칙
  title: 서로 다른 인가자 둘
  body: 정해진 순서·시간에 두 사람이 인증해야 통과를 허용한다. 카드 대여만으로 조건을 흉내 내지 못하게 한다.
- kicker: Escort · 동행
  title: 방문자와 책임자 함께
  body: 방문자의 자격·동행자의 권한·실제 동행을 확인한다. 동행자가 먼저 나갈 때의 처리도 정한다.
- kicker: First-Person-In · 최초 입실 조건
  title: 책임자가 먼저 도착
  body: 지정된 최초 입실자가 인증하기 전에는 일반 출입이나 시간표 개방을 시작하지 않는다.
- kicker: Schedule · 시간표
  title: 근무·작업 시간 제한
  body: 야간·주말·휴일을 구분한다. 시간표 출입과 별도 승인으로 활성화하는 JIT는 다르다.
:::

:::takeaway 직무분리와의 차이
SoD는 책임과 권한의 분리다. 두 사람 규칙은 현장에서 함께 참여해야 한다는 출입 조건이다.
:::

동행 조건이 깨지거나 출입 상태가 불일치해도 피난 경로를 막는 방식으로 처리하지 않는다.

## note
[대사] @s-28-b1-i1 Two-Person Rule · 두 사람 규칙 서로 다른 인가자 둘 정해진 순서·시간에 두 사람이 인증해야 통과를 허용한다. 카드 대여만으로 조건을 흉내 내지 못하게 한다.
[대사] @s-28-b1-i2 Escort · 동행 방문자와 책임자 함께 방문자의 자격·동행자의 권한·실제 동행을 확인한다. 동행자가 먼저 나갈 때의 처리도 정한다.
[대사] @s-28-b1-i3 First-Person-In · 최초 입실 조건 책임자가 먼저 도착 지정된 최초 입실자가 인증하기 전에는 일반 출입이나 시간표 개방을 시작하지 않는다.
[대사] @s-28-b1-i4 Schedule · 시간표 근무·작업 시간 제한 야간·주말·휴일을 구분한다. 시간표 출입과 별도 승인으로 활성화하는 JIT는 다르다.
[대사] @s-28-b2 직무분리와의 차이 SoD는 책임과 권한의 분리다. 두 사람 규칙은 현장에서 함께 참여해야 한다는 출입 조건이다.
[대사] @s-28-b3 동행 조건이 깨지거나 출입 상태가 불일치해도 피난 경로를 막는 방식으로 처리하지 않는다.

# slide
title: APB는 기록된 입실·퇴실 순서와 구역 상태를 검사한다
tag: 2부 · 안티패스백
group: 2부 · 안전과 권한
refs: [S22, S28]

:::terms
APB | Anti-Passback | 정상 퇴실 없는 재입실 등 출입 순서의 모순을 제한
:::

:::html
<div class="apb-demo"><div class="apb-person"><i data-lucide="contact-round"></i><span>교육용 출입증 A</span><strong id="apb-state">기록 상태 · 외부</strong></div><div class="apb-buttons"><button class="action" data-apb="in">외부 → 로비 태그</button><button class="action" data-apb="out">로비 → 외부 태그</button><button class="action" data-apb="inner">로비 → 핵심구역 시도</button><button class="action secondary" data-apb="reset">상태 초기화</button></div></div>
:::

:::html
<div class="outcome-panel horizontal" id="apb-result" aria-live="polite"><strong>순서 검증 준비</strong><p>외부 상태에서 입실 태그를 누른 뒤 다시 입실 태그를 눌러 본다.</p></div>
:::

:::takeaway 로컬과 글로벌
로컬 APB는 해당 컨트롤러의 구역 상태를 사용한다. 글로벌 APB는 여러 컨트롤러가 공유하는 상태로 판단하므로 동기화와 장애 정책이 중요하다.
:::

APB 상태는 실제 위치와 다를 수 있다. 누락 태그·동반 통과·초기화·통신 장애를 함께 확인한다.

## note
[대사] @s-29-b1 APB Anti-Passback 정상 퇴실 없는 재입실 등 출입 순서의 모순을 제한
[대사] @s-29-b2 교육용 출입증 A 기록 상태 · 외부 외부 → 로비 태그 로비 → 외부 태그 로비 → 핵심구역 시도 상태 초기화
[대사] @s-29-b3 순서 검증 준비 외부 상태에서 입실 태그를 누른 뒤 다시 입실 태그를 눌러 본다.
[대사] @s-29-b4 로컬과 글로벌 로컬 APB는 해당 컨트롤러의 구역 상태를 사용한다. 글로벌 APB는 여러 컨트롤러가 공유하는 상태로 판단하므로 동기화와 장애 정책이 중요하다.
[대사] @s-29-b5 APB 상태는 실제 위치와 다를 수 있다. 누락 태그·동반 통과·초기화·통신 장애를 함께 확인한다.

# slide
title: 경보 이름을 실제 상태와 대응 행동으로 바꿔 읽는다
tag: 2부 · 경보와 관제
group: 2부 · 안전과 권한
refs: [S13, S22]

| 경보·운영 용어 | 쉽게 풀어 쓴 뜻 | 관제에서 먼저 확인할 것 |
|---|---|---|
| Impossible Travel · 불가능한 이동 | 너무 짧은 시간에 먼 곳의 리더를 연속 사용. | 거리·장비 시각 오차·늦게 도착한 기록. |
| Tailgating · 동반 통과 | 인증한 사람보다 더 많은 사람이 지나간 정황. | 통과 센서·영상·승인된 동행 여부. |
| Forced Open · 비정상 문 열림 | 허용된 개방 원인 없이 문 열림이 감지됨. | 퇴실 요청·소방·원격 명령·배선 상태. |
| Door Held Open · 장시간 열림 | 설정한 시간 이상 문이 열린 상태. | 운반 작업·문 고정·닫힘 장치·센서. |
| Duress PIN · 위협 상황용 비밀 번호 | 강요 상황을 조용히 알리도록 설정한 입력. | 경보 전달·담당자 확인·출동 절차. |

:::takeaway 경보만으로 원인을 확정하지 않는다
정상 패닉바 퇴실도 퇴실 입력이 누락되면 Forced Open으로 기록될 수 있다. 동작 설정과 실제 상황을 확인한다.
:::

## note
[대사] @s-30-b1 경보·운영 용어 쉽게 풀어 쓴 뜻 관제에서 먼저 확인할 것 Impossible Travel · 불가능한 이동 너무 짧은 시간에 먼 곳의 리더를 연속 사용. 거리·장비 시각 오차·늦게 도착한 기록. Tailgating · 동반 통과 인증한 사람보다 더 많은 사람이 지나간 정황. 통과 센서·영상·승인된 동행 여부. Forced Open · 비정상 문 열림 허용된 개방 원인 없이 문 열림이 감지됨. 퇴실 요청·소방·원격 명령·배선 상태. Door Held Open · 장시간 열림 설정한 시간 이상 문이 열린 상태. 운반 작업·문 고정·닫힘 장치·센서. Duress PIN · 위협 상황용 비밀 번호 강요 상황을 조용히 알리도록 설정한 입력. 경보 전달·담당자 확인·출동 절차.
[대사] @s-30-b2 경보만으로 원인을 확정하지 않는다 정상 패닉바 퇴실도 퇴실 입력이 누락되면 Forced Open으로 기록될 수 있다. 동작 설정과 실제 상황을 확인한다.

# slide
title: 연동 용어는 어느 구간에서 쓰이는지 함께 읽는다
tag: 2부 · 시스템 연동
group: 2부 · 안전과 권한
refs: [S19, S20, S24, S30, A05]

| 약어 · 전체 이름 | 쉽게 풀어 쓴 역할 | 물리 출입에서의 적용 예 |
|---|---|---|
| SCIM · System for Cross-domain Identity Management | 시스템 사이의 사용자·그룹 생성·변경·삭제. | 인사 변경을 출입 권한 관리에 전달. 지원 속성과 회수 반영 확인. |
| OIDC · OpenID Connect | 로그인한 사용자의 신원 정보를 전달. | 관리 콘솔·방문자 화면의 통합 로그인. 문 앞 카드 인증과 구분. |
| TLS · Transport Layer Security | 네트워크 연결의 암호화와 상대 인증. | 서버·관리 콘솔 연결 보호. 인증서와 만료 관리. |
| PDP · Policy Decision Point | 정책에 따라 허용·거부를 결정하는 지점. | 권한 정책의 결정 역할. 제품에 따라 서버·현장에 배치. |
| PEP · Policy Enforcement Point | 결정된 접근 정책을 실제 집행하는 지점. | 컨트롤러가 허용된 경우 전기정 제어. |

:::takeaway 제품별 확인
이 표는 기능을 나눈 개념 모델이다. 표준 이름이 같아도 연동 항목·지원 버전·오프라인 동작은 같지 않을 수 있다.
:::

## note
[대사] @s-31-b1 약어 · 전체 이름 쉽게 풀어 쓴 역할 물리 출입에서의 적용 예 SCIM · System for Cross-domain Identity Management 시스템 사이의 사용자·그룹 생성·변경·삭제. 인사 변경을 출입 권한 관리에 전달. 지원 속성과 회수 반영 확인. OIDC · OpenID Connect 로그인한 사용자의 신원 정보를 전달. 관리 콘솔·방문자 화면의 통합 로그인. 문 앞 카드 인증과 구분. TLS · Transport Layer Security 네트워크 연결의 암호화와 상대 인증. 서버·관리 콘솔 연결 보호. 인증서와 만료 관리. PDP · Policy Decision Point 정책에 따라 허용·거부를 결정하는 지점. 권한 정책의 결정 역할. 제품에 따라 서버·현장에 배치. PEP · Policy Enforcement Point 결정된 접근 정책을 실제 집행하는 지점. 컨트롤러가 허용된 경우 전기정 제어.
[대사] @s-31-b2 제품별 확인 이 표는 기능을 나눈 개념 모델이다. 표준 이름이 같아도 연동 항목·지원 버전·오프라인 동작은 같지 않을 수 있다.

# slide
title: 관리자 권한과 비상 개방에도 범위와 책임이 필요하다
tag: 2부 · 관리자와 비상 예외
group: 2부 · 안전과 권한
refs: [S24, S31, S36]

:::cards cols=3
- kicker: 평상시 관리
  title: 필요한 작업만 허용
  body: 출입증 발급·권한 승인·문 원격 개방·정책 수정의 담당 권한을 구분한다.
- kicker: Break-glass · 비상 예외
  title: 긴급할 때 제한된 예외 사용
  body: 일반 승인 절차를 따르기 어려운 비상 상황에서 쓴다. 대상·사유·사용자를 기록하고 즉시 알린다.
- kicker: 비상 종료 후
  title: 예외 회수와 독립 검토
  body: 확대한 권한을 끝내고 문 상태·정책을 복구한다. 다른 담당자가 사용 사유와 조치를 확인한다.
:::

:::takeaway 예 · 야간 설비 사고
당직자가 지정 구역을 임시 개방하고 책임자에게 알린다. 사고가 끝나면 임시 권한을 회수하고 문 닫힘·잠금을 확인한다.
:::

:::takeaway Lockdown · 보안상 출입 제한
외부 진입을 제한하는 비상 모드라도 승인된 피난 기능을 막아서는 안 된다. 비상 해제와 복구 우선순위를 문별로 정한다.
:::

## note
[대사] @s-32-b1-i1 평상시 관리 필요한 작업만 허용 출입증 발급·권한 승인·문 원격 개방·정책 수정의 담당 권한을 구분한다.
[대사] @s-32-b1-i2 Break-glass · 비상 예외 긴급할 때 제한된 예외 사용 일반 승인 절차를 따르기 어려운 비상 상황에서 쓴다. 대상·사유·사용자를 기록하고 즉시 알린다.
[대사] @s-32-b1-i3 비상 종료 후 예외 회수와 독립 검토 확대한 권한을 끝내고 문 상태·정책을 복구한다. 다른 담당자가 사용 사유와 조치를 확인한다.
[대사] @s-32-b2 예 · 야간 설비 사고 당직자가 지정 구역을 임시 개방하고 책임자에게 알린다. 사고가 끝나면 임시 권한을 회수하고 문 닫힘·잠금을 확인한다.
[대사] @s-32-b3 Lockdown · 보안상 출입 제한 외부 진입을 제한하는 비상 모드라도 승인된 피난 기능을 막아서는 안 된다. 비상 해제와 복구 우선순위를 문별로 정한다.

# slide
title: 출입 목적에 필요한 정보만 수집하고 안전하게 관리한다
tag: 2부 · 개인정보 보호
group: 2부 · 안전과 권한
refs: [A04, S26]

:::cards cols=3
- kicker: 수집 전
  title: 목적과 처리 근거 확인
  body: 본인 확인·출입 운영에 필요한 항목을 정한다. 생체정보는 식별 목적과 처리 방식에 맞는 법적 요건을 확인한다.
- kicker: 사용 중
  title: 접근 제한과 암호화
  body: 원본 사진·생체 템플릿·출입 기록을 구분한다. 운영자에게 업무상 필요한 범위만 보이게 한다.
- kicker: 사용 종료
  title: 보존 기간과 파기 관리
  body: 계약 종료·자격 회수와 함께 보존 필요성을 검토한다. 백업·장치 내부 저장본의 처리도 정한다.
:::

:::takeaway 생체 템플릿(Biometric Template)
얼굴·지문에서 추출한 특징을 비교용으로 저장한 정보다. 원본 사진과 형태가 달라도 식별에 쓰이면 보호가 필요하다.
:::

보존 기간을 일률적인 숫자로 외우기보다 처리 목적·적용 법령·업무상 필요에 맞춰 정한다.

## note
[대사] @s-33-b1-i1 수집 전 목적과 처리 근거 확인 본인 확인·출입 운영에 필요한 항목을 정한다. 생체정보는 식별 목적과 처리 방식에 맞는 법적 요건을 확인한다.
[대사] @s-33-b1-i2 사용 중 접근 제한과 암호화 원본 사진·생체 템플릿·출입 기록을 구분한다. 운영자에게 업무상 필요한 범위만 보이게 한다.
[대사] @s-33-b1-i3 사용 종료 보존 기간과 파기 관리 계약 종료·자격 회수와 함께 보존 필요성을 검토한다. 백업·장치 내부 저장본의 처리도 정한다.
[대사] @s-33-b2 생체 템플릿(Biometric Template) 얼굴·지문에서 추출한 특징을 비교용으로 저장한 정보다. 원본 사진과 형태가 달라도 식별에 쓰이면 보호가 필요하다.
[대사] @s-33-b3 보존 기간을 일률적인 숫자로 외우기보다 처리 목적·적용 법령·업무상 필요에 맞춰 정한다.

# slide
title: 설치 후에는 정상 동작과 거부 동작을 함께 확인한다
tag: 3부 · 운영 확인
group: 2부 · 안전과 권한
refs: [S13, S24, S28]

### 아래는 현장 인수 확인 항목의 예시다. 실제 장비 시험 결과를 뜻하지 않는다.

| 항목 | 시험 조건 | 확인할 결과 |
|---|---|---|
| T01 · 출입 자격 | 유효·분실·만료·회수 자격을 각각 제시. | 유효 자격만 허용되고 나머지는 기대한 사유로 거부. |
| T02 · 다중 인증 | 한 요소 누락·오류와 정상 조합을 비교. | 부분 인증 상태에서는 잠금 해제 안 됨. |
| T03 · 리더 통신 | 보안 채널 설정·재연결·키 오류 확인. | 암호화·인증 유지, 설정한 오류 처리와 경보. |
| T04 · 오프라인 | 서버 연결 중단 중 유효·만료 자격 제시. | 정한 캐시·만료 정책대로 동작. 복구 후 동기화. |
| T05 · APB | 정상 입퇴실과 연속 입실·누락 태그 비교. | 구역 상태에 따른 허용·거부와 예외 처리. |
| T06 · 문 센서 | 허용 후 열지 않음·열고 닫음을 구분. | 문 상태·재잠금·장시간 열림 판단 일치. |

## note
[대사] @s-34-b1 아래는 현장 인수 확인 항목의 예시다. 실제 장비 시험 결과를 뜻하지 않는다.
[대사] @s-34-b2 항목 시험 조건 확인할 결과 T01 · 출입 자격 유효·분실·만료·회수 자격을 각각 제시. 유효 자격만 허용되고 나머지는 기대한 사유로 거부. T02 · 다중 인증 한 요소 누락·오류와 정상 조합을 비교. 부분 인증 상태에서는 잠금 해제 안 됨. T03 · 리더 통신 보안 채널 설정·재연결·키 오류 확인. 암호화·인증 유지, 설정한 오류 처리와 경보. T04 · 오프라인 서버 연결 중단 중 유효·만료 자격 제시. 정한 캐시·만료 정책대로 동작. 복구 후 동기화. T05 · APB 정상 입퇴실과 연속 입실·누락 태그 비교. 구역 상태에 따른 허용·거부와 예외 처리. T06 · 문 센서 허용 후 열지 않음·열고 닫음을 구분. 문 상태·재잠금·장시간 열림 판단 일치.

# slide
title: 비상·전원·안전·복구를 실제 운영 조건으로 확인한다
tag: 3부 · 운영 확인
group: 2부 · 안전과 권한
refs: [S13, S24, L01, A04]

| 항목 | 무엇을 확인하는가? |
|---|---|
| T07 · 비정상 열림 | 승인된 시험 조건에서 문 열림 경보와 관제 확인·대응. |
| T08 · 소방 연동 | 승인된 연동표에 따른 문별 잠금 해제·피난·방화문 닫힘. |
| T09 · 정전·UPS | 전원 경로·전환·지속 시간과 전원 복구 후 잠금 상태. |
| T10 · 끼임 방지 | 제조사 시험 절차와 적합한 도구로 안전 센서·정지·개방 확인. |
| T11 · 기록 동기화 | 통신 중단·재부팅 후 누락·중복·시각 차이·지연 수신 확인. |
| T12 · 백업 복구 | 별도 시험 환경에서 설정·자격 복구와 암호키 보호 확인. |
| T13 · 관리자 감사 | 누가 어떤 대상에 어떤 이유로 변경했는지와 독립 검토 확인. |
| T14 · 생체정보 보호 | 처리 근거·최소 수집·접근 제한·보존·파기가 실제 설정과 일치. |

:::takeaway 현장 안전
소방·피난·끼임 시험은 시설 책임자와 승인된 절차로 수행한다. 사람을 위험에 노출해 시험하지 않는다.
:::

## note
[대사] @s-35-b1 항목 무엇을 확인하는가? T07 · 비정상 열림 승인된 시험 조건에서 문 열림 경보와 관제 확인·대응. T08 · 소방 연동 승인된 연동표에 따른 문별 잠금 해제·피난·방화문 닫힘. T09 · 정전·UPS 전원 경로·전환·지속 시간과 전원 복구 후 잠금 상태. T10 · 끼임 방지 제조사 시험 절차와 적합한 도구로 안전 센서·정지·개방 확인. T11 · 기록 동기화 통신 중단·재부팅 후 누락·중복·시각 차이·지연 수신 확인. T12 · 백업 복구 별도 시험 환경에서 설정·자격 복구와 암호키 보호 확인. T13 · 관리자 감사 누가 어떤 대상에 어떤 이유로 변경했는지와 독립 검토 확인. T14 · 생체정보 보호 처리 근거·최소 수집·접근 제한·보존·파기가 실제 설정과 일치.
[대사] @s-35-b2 현장 안전 소방·피난·끼임 시험은 시설 책임자와 승인된 절차로 수행한다. 사람을 위험에 노출해 시험하지 않는다.

# slide
title: 권한은 부여뿐 아니라 만료·회수·충돌까지 시험한다
tag: 3부 · 권한 확인
group: 2부 · 안전과 권한
refs: [S29, S30, S31, S33]

| 항목 | 조건을 바꾸어 확인 | 기대하는 결과 |
|---|---|---|
| T15 · 역할 합성 | 역할 상속·중복·충돌·명시적 거부. | 제품의 정책 규칙과 실제 출입 결과가 일치. |
| T16 · 속성 조건 | 교육·계약 만료, 속성 조회 실패·갱신 지연. | 정해진 거부·예외·캐시 처리와 일치. |
| T17 · JIT 경계 | 시작 직전·직후와 만료 직전·직후. | 허용 기간에만 신규 입실 가능. 시계 오차도 확인. |
| T18 · 회수 반영 | 중앙 회수 후 컨트롤러 적용까지 확인. | 합의한 반영 시간 이내에 현장 거부 확인. |
| T19 · 직무분리 | 자기 승인·충돌 역할·비상 예외를 비교. | 자기 승인 제한과 독립 검토 유지. |

:::terms
SLA | Service Level Agreement | 서비스 수준 합의 · 여기서는 회수 반영 목표 시간 등의 기준
:::

:::takeaway 확인 예
“서버에서 권한을 삭제했다”에 더해 “해당 문에서 이전 자격이 거부됐다”까지 확인한다.
:::

## note
[대사] @s-36-b1 항목 조건을 바꾸어 확인 기대하는 결과 T15 · 역할 합성 역할 상속·중복·충돌·명시적 거부. 제품의 정책 규칙과 실제 출입 결과가 일치. T16 · 속성 조건 교육·계약 만료, 속성 조회 실패·갱신 지연. 정해진 거부·예외·캐시 처리와 일치. T17 · JIT 경계 시작 직전·직후와 만료 직전·직후. 허용 기간에만 신규 입실 가능. 시계 오차도 확인. T18 · 회수 반영 중앙 회수 후 컨트롤러 적용까지 확인. 합의한 반영 시간 이내에 현장 거부 확인. T19 · 직무분리 자기 승인·충돌 역할·비상 예외를 비교. 자기 승인 제한과 독립 검토 유지.
[대사] @s-36-b2 SLA Service Level Agreement 서비스 수준 합의 · 여기서는 회수 반영 목표 시간 등의 기준
[대사] @s-36-b3 확인 예 “서버에서 권한을 삭제했다”에 더해 “해당 문에서 이전 자격이 거부됐다”까지 확인한다.

# slide
title: 세 가지 상황으로 핵심 원리를 다시 확인한다
tag: 3부 · 개념 정리
group: 2부 · 안전과 권한

:::cards cols=3
- kicker: "01"
  title: 유효한 카드지만 안전교육이 만료됐다.
  body: 인증은 성공할 수 있어도, 교육을 조건으로 둔 ABAC 정책은 출입을 거부한다.
- kicker: "02"
  title: JIT가 만료됐는데 컨트롤러 통신이 끊겼다.
  body: 중앙 만료와 현장 회수를 구분한다. 로컬 만료 기능·장비 시각·복구 후 적용을 확인한다.
- kicker: "03"
  title: Fail-Safe 잠금장치의 전원이 끊겼다.
  body: 잠금이 해제된다. 문짝이 자동으로 벌어지는 뜻은 아니며 방화문 닫힘과 피난 동작은 따로 확인한다.
:::

:::takeaway 공통 원리
신원 확인 → 권한 판단 → 현장 집행 → 상태 확인. 각 단계가 무엇을 보장하는지 구분한다.
:::

## note
[대사] @s-37-b1-i1 01 유효한 카드지만 안전교육이 만료됐다. 인증은 성공할 수 있어도, 교육을 조건으로 둔 ABAC 정책은 출입을 거부한다.
[대사] @s-37-b1-i2 02 JIT가 만료됐는데 컨트롤러 통신이 끊겼다. 중앙 만료와 현장 회수를 구분한다. 로컬 만료 기능·장비 시각·복구 후 적용을 확인한다.
[대사] @s-37-b1-i3 03 Fail-Safe 잠금장치의 전원이 끊겼다. 잠금이 해제된다. 문짝이 자동으로 벌어지는 뜻은 아니며 방화문 닫힘과 피난 동작은 따로 확인한다.
[대사] @s-37-b2 공통 원리 신원 확인 → 권한 판단 → 현장 집행 → 상태 확인. 각 단계가 무엇을 보장하는지 구분한다.

# slide
title: 정의·제조사 문서·법령의 적용 범위를 대조한다
tag: 참고 자료
group: 2부 · 안전과 권한

:::cards cols=3
- kicker: 개념과 표준
  title: NIST · SIA · RFC · OpenID
  body: 인증 오류율, 역할·속성 정책, 리더 보안 채널, 신원 연동의 정의를 확인한다.
- kicker: 장비와 구성
  title: Axis · Genetec · Allegion 등
  body: 모델·설정·배선·펌웨어에 따라 달라지는 동작은 해당 제품 문서로 확인한다.
- kicker: 법령과 현장
  title: 국가법령정보센터 · 시설 기준
  body: 국내 법령의 적용 대상과 해당 건물·문별 피난 요구를 확인한다.
:::

:::html
<div class="actions"><button class="action" data-source="all">참고문헌 전체 보기</button><button class="action secondary" data-media="">이미지·영상 출처 보기</button></div>
:::

:::takeaway 이 강의의 그림
생성 개념도는 구조를 설명하는 그림이다. 제품 사진·연결 예시는 해당 제조사의 특정 제품 자료다. 이미지 확대는 오프라인에서도 가능하다.
:::

각 장 하단의 출처 버튼으로 관련 원문을 열 수 있다. 외부 원문과 영상 재생에는 인터넷 연결이 필요하다.

## note
[대사] @s-38-b1-i1 개념과 표준 NIST · SIA · RFC · OpenID 인증 오류율, 역할·속성 정책, 리더 보안 채널, 신원 연동의 정의를 확인한다.
[대사] @s-38-b1-i2 장비와 구성 Axis · Genetec · Allegion 등 모델·설정·배선·펌웨어에 따라 달라지는 동작은 해당 제품 문서로 확인한다.
[대사] @s-38-b1-i3 법령과 현장 국가법령정보센터 · 시설 기준 국내 법령의 적용 대상과 해당 건물·문별 피난 요구를 확인한다.
[대사] @s-38-b2 참고문헌 전체 보기 이미지·영상 출처 보기
[대사] @s-38-b3 이 강의의 그림 생성 개념도는 구조를 설명하는 그림이다. 제품 사진·연결 예시는 해당 제조사의 특정 제품 자료다. 이미지 확대는 오프라인에서도 가능하다.
[대사] @s-38-b4 각 장 하단의 출처 버튼으로 관련 원문을 열 수 있다. 외부 원문과 영상 재생에는 인터넷 연결이 필요하다.

# slide quote id=closing
title: 누구인지 확인하고, *필요한 권한만 허용하며,* 안전한 퇴실을 보장한다.
toc: 인증에서 현장 동작까지
tag: PHYSICAL ACCESS · IDENTITY · AUTHORIZATION

카드 하나의 성공 표시보다 사람·정책·장비·피난이 함께 맞는지 확인한다.

:::pills
- 인증과 인가 구분
- 만료·회수까지 관리
- 현장 상태 확인
:::

## note
[대사] PHYSICAL ACCESS · IDENTITY · AUTHORIZATION 누구인지 확인하고, 필요한 권한만 허용하며, 안전한 퇴실을 보장한다.
[대사] @closing-b1 카드 하나의 성공 표시보다 사람·정책·장비·피난이 함께 맞는지 확인한다.
[대사] @closing-b2 인증과 인가 구분 만료·회수까지 관리 현장 상태 확인

# slide references id=references
title: 출처 및 참고자료
tag: 참고 자료 · 공식 문서와 미디어
only: [S04, S19, S20, S29, S30, S31, S32, S33, S34, S35, S36, A05, S03, S05, S06, S07, S08, S09, S12, B01, B02, B03, C01, C02, C03, S13, S22, S23, S24, S28, W01, W02, W03, W04, S16, S17, S18, S26, W06, W07, W08, L01, L02, A04]

자료 이름을 누르면 원문이 열린다. S·B·W·L·A·C 번호는 각 슬라이드 하단의 출처 표기와 연결된다.

개념도 3종은 imagegen으로 생성했다. 제품 사진·영상의 권리는 각 제공자에게 있다. 외부 원문·영상은 인터넷 연결이 필요하다.

## note
[대사] 강의에서 인용한 참고문헌 44건과 영상 3건을 본문에 표시했다. 자료 이름을 누르면 출처 원문이 새 창으로 열린다. 이미지 출처 버튼에서는 각 이미지의 권리자와 원문을 확인할 수 있다.
