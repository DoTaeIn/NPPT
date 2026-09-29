// Quiz CSS, injected once through ctx.registerStyles. Only `.mq*` classes, in the slide (`.mq`) and
// inside the runtime dialog (`.mq-dlg`); colours come from the theme tokens (--primary, --navy,
// --muted, --border, --bg-card, --ok, --danger, with --ok-text/--danger-text for text when defined)
// so v20-violet and cau-navy both work. Button rules carry `#dialog` in their selector so they beat
// the chrome's `#dialog button { font: inherit; color: inherit }`. In-slide sizes are canvas pixels
// (1920×1080); dialog sizes are screen pixels (`--mq-fs` is the option/body size of each context).
const Q = ':is(.mq,#dialog .mq-dlg)';

export const QUIZ_CSS = `
.mq-host{display:flex;flex-direction:column;min-height:0}
.mq,.mq-dlg{--mq-p:var(--primary,#6B4BFF);--mq-ink:var(--navy,#1A1B4D);--mq-text:var(--text,#1C1C2E);--mq-mut:var(--muted,#566176);--mq-line:var(--border,#E8E5F5);--mq-card:var(--bg-card,#F7F5FD);--mq-bg:var(--bg,#fff);--mq-ok:var(--ok,#16A34A);--mq-no:var(--danger,#E03131);--mq-ok-t:var(--ok-text,var(--mq-ok));--mq-no-t:var(--danger-text,var(--mq-no));--mq-ok-soft:var(--ok-soft,#ECFDF5);--mq-no-soft:var(--danger-soft,#FFF1F4);--mq-fs:22px;color:var(--mq-text)}
.mq{flex:1 1 auto;display:flex;flex-direction:column;gap:16px;min-height:0;min-width:0}
.mq-dlg{--mq-fs:16px;display:flex;flex-direction:column;gap:14px}
${Q} :is(p,h3,ol,table){margin:0}
${Q} .mq-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:2.2em;padding:0 1em;border:2px solid var(--mq-line);border-radius:12px;background:var(--mq-bg);color:var(--mq-ink);font:inherit;font-size:var(--mq-fs);font-weight:700;cursor:pointer;white-space:nowrap}
${Q} .mq-btn:hover{border-color:var(--mq-p);color:var(--mq-p)}
${Q} .mq-btn.primary{border-color:var(--mq-p);background:var(--mq-p);color:#fff}
${Q} .mq-btn.primary:hover{filter:brightness(1.08);color:#fff}
.mq-grid{flex:1 1 auto;display:grid;grid-template-columns:repeat(var(--mq-cols,2),minmax(0,1fr));grid-auto-rows:1fr;gap:20px;min-height:0}
.mq-card{display:flex;flex-direction:column;align-items:stretch;gap:12px;min-width:0;min-height:128px;overflow:hidden;padding:20px 26px;border:2px solid var(--mq-line);border-radius:18px;background:var(--mq-card);color:var(--mq-text);font:inherit;text-align:left;cursor:pointer;transition:border-color .15s,background .15s}
.mq-card:hover{border-color:var(--mq-p)}
.mq-card>*{flex-shrink:0}
.mq-head,.mq-item-head{display:flex;align-items:center;gap:12px;min-width:0}
.mq .mq-no{padding:3px 12px;border-radius:8px;background:var(--mq-p);color:#fff;font-size:20px;font-weight:800;font-variant-numeric:tabular-nums}
.mq .mq-no{flex:none}
.mq .mq-area{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:20px;font-weight:600;color:var(--mq-mut)}
.mq-key{font-size:30px;line-height:1.3;font-weight:800;color:var(--mq-ink);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.mq-qt{font-size:22px;line-height:1.5;color:var(--mq-mut);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.mq-grid.is-dense{gap:16px}
.mq-grid.is-dense .mq-card{gap:6px;min-height:0;padding:14px 18px;border-radius:14px}
.mq-grid.is-dense .mq-no{font-size:17px;padding:2px 9px}
.mq-grid.is-dense .mq-area{font-size:17px}
.mq-grid.is-dense .mq-key{font-size:25px;-webkit-line-clamp:2}
.mq-grid.is-dense .mq-state{font-size:17px}
.mq-grid.is-dense .mq-qt{display:none}
.mq-state{margin-top:auto;font-size:20px;font-weight:700;color:var(--mq-p)}
.mq-card[data-state=ok]{border-color:var(--mq-ok);background:var(--mq-ok-soft)}
.mq-card[data-state=wrong]{border-color:var(--mq-no);background:var(--mq-no-soft)}
.mq-card[data-state=ok] .mq-state{color:var(--mq-ok-t)}
.mq-card[data-state=wrong] .mq-state{color:var(--mq-no-t)}
.mq-status{font-size:20px;color:var(--mq-mut);text-align:right}
.mq-status b{color:var(--mq-ink)}
.mq-empty{padding:24px;border:2px dashed var(--mq-line);border-radius:18px;color:var(--mq-mut);font-size:22px}
.mq-q{font-size:calc(var(--mq-fs) + 3px);line-height:1.5;font-weight:700;color:var(--mq-ink)}
.mq-opts{display:flex;flex-direction:column;gap:8px}
${Q} .mq-opt{display:flex;align-items:flex-start;gap:12px;width:100%;padding:.55em .9em;border:2px solid var(--mq-line);border-radius:12px;background:var(--mq-bg);color:var(--mq-text);font:inherit;font-size:var(--mq-fs);line-height:1.5;text-align:left;cursor:pointer}
${Q} .mq-opt:hover{border-color:var(--mq-p)}
${Q} .mq-opt[aria-disabled=true]{cursor:default}
${Q} .mq-opt[aria-disabled=true]:hover{border-color:var(--mq-line)}
${Q} .mq-opt[aria-pressed=true]{border-color:var(--mq-p);background:var(--mq-card)}
${Q} .mq-opt.is-answer{border-color:var(--mq-ok);background:var(--mq-ok-soft)}
${Q} .mq-opt.is-wrong{border-color:var(--mq-no);background:var(--mq-no-soft)}
.mq-mark{flex:none;font-weight:800;color:var(--mq-p)}
.mq-otext{flex:1}
.mq-tag{flex:none;align-self:center;padding:0 .6em;border-radius:999px;background:var(--mq-bg);font-size:.8em;font-weight:800;color:var(--mq-mut)}
.is-answer .mq-tag{color:var(--mq-ok-t)}
.is-wrong .mq-tag{color:var(--mq-no-t)}
.mq-hint{font-size:.9em;color:var(--mq-mut)}
.mq-feedback{display:flex;flex-direction:column;gap:10px}
.mq-verdict{font-size:calc(var(--mq-fs) + 1px);font-weight:800}
.mq-verdict.is-ok{color:var(--mq-ok-t)}
.mq-verdict.is-wrong{color:var(--mq-no-t)}
.mq-verdict.is-blank{color:var(--mq-mut)}
.mq-exp{padding:.7em 1em;border:1px solid var(--mq-line);border-radius:12px;background:var(--mq-card);font-size:var(--mq-fs);line-height:1.6}
.mq-exp-k{margin-right:6px;font-weight:800;color:var(--mq-p)}
.mq-refs{display:flex;flex-wrap:wrap;gap:6px}
${Q} .mq-ref{padding:2px 12px;border:1px solid var(--mq-line);border-radius:999px;background:var(--mq-bg);color:var(--mq-p);font:inherit;font-size:calc(var(--mq-fs) - 2px);font-weight:700;cursor:pointer}
${Q} .mq-ref:hover{border-color:var(--mq-p)}
${Q} .mq-ref.is-plain{color:var(--mq-mut);font-weight:500;cursor:default}
.mq-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px}
.mq-actions:empty{display:none}
.mq-start{flex:1 1 auto;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:32px;border:2px solid var(--mq-line);border-radius:20px;background:var(--mq-card);text-align:center}
.mq-kicker{font-size:22px;font-weight:800;letter-spacing:.08em;color:var(--mq-p)}
.mq-title{font-size:40px;line-height:1.25;color:var(--mq-ink)}
.mq-lead{max-width:760px;font-size:24px;line-height:1.55;color:var(--mq-mut)}
.mq-minutes{display:flex;align-items:center;gap:16px}
${Q} .mq-min{width:2.2em;padding:0;--mq-fs:28px}
.mq-min-val{min-width:4em;font-size:34px;color:var(--mq-ink);font-variant-numeric:tabular-nums}
.mq-meta{font-size:20px;color:var(--mq-mut)}
${Q} .mq-begin{min-height:64px;padding:0 40px;--mq-fs:28px}
.mq-bar{display:flex;align-items:center;gap:16px;flex-wrap:wrap;padding:12px 18px;border:2px solid var(--mq-line);border-radius:16px;background:var(--mq-card)}
.mq-bar-title{font-size:24px;color:var(--mq-ink)}
.mq-total{color:var(--mq-p)}
.mq-progress{margin-right:auto;font-size:20px;color:var(--mq-mut)}
.mq-timer{font-size:30px;font-weight:800;color:var(--mq-p);font-variant-numeric:tabular-nums}
.mq-timer.is-warn{color:var(--mq-no-t)}
.mq-list{flex:1 1 0;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:14px;padding:0 6px 0 0;list-style:none}
.mq-item{display:flex;flex-direction:column;gap:10px;padding:16px 20px;border:2px solid var(--mq-line);border-radius:16px;background:var(--mq-bg)}
.mq-item[data-state=answered]{border-color:var(--mq-p)}
.mq-item[data-state=ok]{border-color:var(--mq-ok)}
.mq-item[data-state=wrong]{border-color:var(--mq-no)}
.mq-exam{--mq-fs:20px}
.mq-exam .mq-opts{display:grid;grid-template-columns:1fr 1fr}
.mq-exam .mq-q{font-size:24px}
#dialog .mq-note{padding:8px 12px;border-radius:10px;background:var(--mq-no-soft);color:var(--mq-no-t);font-weight:700}
#dialog .mq-score{display:flex;align-items:baseline;justify-content:center;gap:8px}
#dialog .mq-score b{font-size:56px;line-height:1.1;color:var(--mq-p)}
#dialog .mq-score span{font-size:20px;color:var(--mq-mut)}
#dialog .mq-grade{text-align:center;font-weight:700;color:var(--mq-ink)}
#dialog .mq-areas{width:100%;border-collapse:collapse;font-size:15px}
#dialog .mq-areas :is(th,td){padding:7px 10px;border-bottom:1px solid var(--mq-line);text-align:left;white-space:nowrap}
#dialog .mq-areas thead th{font-size:13px;color:var(--mq-mut)}
#dialog .mq-areas tbody th{white-space:normal}
#dialog .mq-areas tr.is-weak{background:var(--mq-no-soft)}
#dialog .mq-meter{display:inline-block;width:110px;height:8px;margin-right:8px;border-radius:999px;background:var(--mq-line);overflow:hidden;vertical-align:middle}
#dialog .mq-meter i{display:block;height:100%;background:var(--mq-ok)}
#dialog .mq-weak{color:var(--mq-no-t)}
@media print{.mq-list{overflow:hidden}}
`;
