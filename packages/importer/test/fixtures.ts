/**
 * Small legacy-deck fixtures. Kept as template strings (not .html files) so the formatter never
 * reflows the markup: whitespace between inline elements changes the extracted text.
 */

/** A 1×1 PNG, base64. */
export const PNG_1X1 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

/** V20 family: cover, content (chain + cards + takeaway + source-link), table + unmapped markup, #lecture-data. */
export const V20_DECK = `<!DOCTYPE html>
<html lang="ko"><head><meta charset="utf-8"><title>3주차 · 테스트 · V20</title></head>
<body><div id="stage"><div id="canvas">
<section class="slide v20-slide cover" data-title="물리보안 · 출입통제 IAM" data-tag="표지" data-note="출입통제의 기술과 운영을 함께 다룬다."><div class='v-cover-art'><img data-asset='pix' alt='사옥 개념도'></div><div class='v-cover-content'><div class='cover-eyebrow'>보안시스템 운영 및 활용 · 3주차</div><h1>문을 여는 기술,<br><em>권한을 다루는 설계.</em></h1><p class='cover-tagline'>장비가 문을 제어하는 방식을 이해한다.</p><div class='cover-chips'><span>인증 · 통신</span><span>피난 · 권한</span></div></div><div class="slide-tag-bottom">보안시스템 운영 및 활용 · 3주차</div></section>
<section class="slide v20-slide " data-title="카드 인식, 허용, 문 열림, 사람 통과는 다른 단계다" data-tag="기본 원리" data-note="01 자격 제시 카드를 리더에 댄다"><div class="slide-wrapper"><div class="eyebrow">기본 원리</div><h2 class="section-title">카드 인식, 허용, 문 열림, 사람 통과는 다른 단계다</h2><div class="s-body"><div class='decision-chain'><article><span>01</span><b>자격 제시</b><small>카드를 리더에 댄다</small></article><article><span>02</span><b>인증</b><small>유효한 자격인지 확인</small></article></div><div class='v-cards cols-2'><article class='v-card'><span class='v-kicker'>허용됐지만 안 들어감</span><h3>허용 신호 ≠ 실제 입실</h3><p>인증 뒤 문을 열지 않을 수도 있다.</p></article><article class='v-card'><span class='v-kicker'>카드 없이 잠금 해제</span><h3>퇴실·소방·원격 개방</h3><p>실내 퇴실 버튼도 잠금을 해제할 수 있다.</p></article></div><div class='takeaway'><b>핵심 구분</b><span>인증은 자격 확인, 인가는 <code>allow</code> 판단이다.</span></div></div></div><div class="slide-tag-bottom"><button class="source-link" data-source="1">참고 출처 S13 ↗</button> · 보안시스템 운영 및 활용 · 3주차</div></section>
<section class="slide v20-slide " data-title="층 이름보다 보호 구역을 먼저 정한다" data-tag="1부 · 구역 설계" data-note=""><div class="slide-wrapper"><div class="eyebrow">1부 · 구역 설계</div><h2 class="section-title">층 이름보다 보호 구역을 먼저 정한다</h2><div class="s-body"><table class='v-table'><thead><tr><th>구역 예</th><th class='c'>확인할 대상</th></tr></thead><tbody><tr><td>외곽·주차장</td><td>차량 | 탑승자</td></tr><tr><td><b>1층 로비</b><small>직원·방문자</small></td><td>“정상” 인증</td></tr></tbody></table><div class='mystery-widget'><canvas></canvas><span>회전하는 3D 모형</span></div><div class='mystery-widget'><div>두 번째</div><div>셋</div></div><p class='fine'>수치는 예시다.</p></div></div><div class="slide-tag-bottom">보안시스템 운영 및 활용 · 3주차</div></section>
</div></div>
<script id="lecture-data" type="application/json">{"assets":{"pix":{"title":"테스트 이미지","credit":"테스트 · 1×1","source":"https://example.org/pix","data":"data:image/png;base64,${PNG_1X1}"}},"refs":[{"id":"S13","url":"https://help.axis.com/","title":"Axis Secure Entry"}],"slideRefs":[[],["S13"],[]],"videos":[{"id":"tTAISQqmxWQ","title":"DEF CON 33 - Intro","author":"DEFCONConference","start":441,"end":737}]}</script>
</body></html>
`;

/** v9.7 family: hero with data-q and a marker note, content with table/callout/pills/source links, window.QUIZ. */
export const V97_DECK = `<!DOCTYPE html>
<html lang="ko"><head><meta charset="utf-8"><title>5주차 · 방화벽</title></head>
<body><main id="deck">
<section class="slide hero has-q alert" data-group="표지 · 도입" data-title="사례 연구 · CISA AA20-283A" data-q="이 공격 체인을 끊을 수 있는 정책은 몇 개일까?" data-note="# 해설 1|P05 · 해설 1–8&#10;&#10;[시간] 2.5분 · 10:00 – 12:30&#10;&#10;[화면] 빨간 경고 배경, &#x27;공격 체인&#x27; 제목.&#10;&#10;[대사] {{p05-c000}} 좋은 수사관은 &quot;사실&quot;부터 모읍니다.&#10;&#10;[홉] {{p05-c001}} 제목으로 이동.&#10;&#10;[학생 질문] {{p05-c002}} 방화벽이 다 막나요?&#10;&#10;[강사 답변] {{p05-c003}} 아니요.&#10;&#10;[발문] {{p05-c004}} 몇 개일까요? | 10초"><svg class="hero-art" viewBox="0 0 10 10"><rect width="10" height="10"/></svg><div class="s-progress"></div><div class="div-wrap"><div class="div-num">!</div><div class="grow"><div class="div-eyebrow">CASE STUDY · AA20-283A</div><h2 class="div-title">경계 장비의 취약점 하나가<br>AD 전체로 이어지는 공격 체인</h2><p class="div-desc">방화벽의 <b>SSL VPN 취약점</b>으로 들어온다.</p></div></div><div class="s-q"><span class="q-tag">학습 동기</span><span class="q-text">이 공격 체인을 끊을 수 있는 정책은 몇 개일까?</span></div><div class="s-foot"><span class="no"></span><span class="brand"><i class="logo"></i><span>보안시스템 운영 및 활용 · 5주차</span></span></div></section>
<section class="slide" data-group="표지 · 도입" data-title="4주차 회수" data-q="⑤·⑥을 멈추는 장비는?" data-note="[대사] {{p06-c000}} 표를 봅니다."><div class="s-progress"></div><div class="s-head"><div class="s-eyebrow"><span>HANDOFF · WEEK 04 → 05</span></div><h1 class="s-title">4주차 회수</h1></div><div class="s-body"><table class="u"><tr><th>단계</th><th>판정</th></tr><tr><td class="key">① 랜포트 연결</td><td><span class="verdict drop"><i data-lucide="circle-x"></i>못 막음</span></td></tr><tr class="hot"><td class="key">⑤ 서버 스캔</td><td><span class="verdict allow">막음</span></td></tr></table><div class="callout warn"><i data-lucide="target"></i><div><b>예상과 결과가 다른 영역</b>이 가장 먼저 볼 곳이다.</div></div><div class="row"><span class="pill navy">문항당 5점</span><span class="pill gray">100점 만점</span></div><div class="small source-links">출처: <a href="https://www.cisa.gov/aa20-283a" target="_blank">CISA AA20-283A</a></div></div><div class="s-foot"><span class="brand"><span>보안시스템 운영 및 활용 · 5주차</span></span></div></section>
</main>
<script>window.QUIZ={"Q01":{"area":1,"areaName":"위치 및 구역 분리","key":"인라인 통과","q":"조건은?","opts":["인라인 통과","같은 L2"],"ans":0,"exp":"NIST SP 800-41"}};
window.TERMS={};</script>
</body></html>
`;
