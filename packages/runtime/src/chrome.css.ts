// Chrome CSS, injected into <head> as <style id="marco-chrome"> at init. It styles only the runtime's
// own elements (ids below, .slide-no/.slide-progress, widget placeholders, #handout) and never slide
// content classes. Stage/canvas/slide geometry uses :where() (zero specificity) so the design system
// can override it; slide visibility and print resets are enforced. Colours follow the design-system
// tokens (--primary, --accent-blue, --navy) when present. Chrome is hidden in print.
const C = '#nav-dock,#toc-sidebar,#notes-panel,#search,#help,#dialog,#pen-toolbar,#marco-toast';

export const CHROME_CSS = `
:root{--mc-accent:var(--primary,#6B4BFF);--mc-accent-2:var(--accent-blue,#3E9CF5);--mc-ink:var(--navy,#1A1B4D);--mc-text:#1F2133;--mc-muted:#626B80;--mc-line:#E3E1EF;--mc-soft:#F4F2FC;--mc-danger:#E03131;--mc-shadow:0 16px 48px rgba(14,15,46,.22);--mc-font:'Pretendard','Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',system-ui,-apple-system,'Segoe UI',sans-serif;--mc-mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
@media screen{html,body{margin:0;height:100%;overflow:hidden}#canvas>section.slide:not(.active){display:none!important}}
:where(#stage){position:fixed;inset:0;overflow:hidden;background:#0E0F2E}
:where(#canvas){position:absolute;left:0;top:0;width:1920px;height:1080px;transform-origin:0 0;background:#fff;transition:transform .2s ease,left .2s ease,top .2s ease}
:where(#canvas>section.slide){position:absolute;left:0;top:0;width:1920px;height:1080px;box-sizing:border-box;overflow:hidden}
:where(.slide-no){position:absolute;left:112px;bottom:34px;font:600 18px/1 var(--mc-font);letter-spacing:.08em;color:var(--muted,#566176)}
:where(.slide-progress){position:absolute;left:0;top:0;height:4px;background:linear-gradient(90deg,var(--mc-accent),var(--mc-accent-2));transition:width .3s ease}
.marco-focus{outline:4px solid var(--mc-accent)!important;outline-offset:6px;box-shadow:0 0 0 12px rgba(107,75,255,.14)}
#pen-canvas,#laser-canvas{position:absolute;left:0;top:0;width:1920px;height:1080px;pointer-events:none;z-index:40}
#laser-canvas{z-index:41}
body.pen-on #pen-canvas{pointer-events:auto;cursor:crosshair;touch-action:none}
body.laser-on #stage{cursor:none}
.ink-text{position:absolute;z-index:42;min-width:260px;margin:0;padding:0 4px;border:2px dashed var(--mc-accent);border-radius:6px;background:rgba(255,255,255,.92);font-family:var(--mc-font);font-weight:600;line-height:1.2;outline:0}
.widget-placeholder{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-height:140px;padding:24px;border:3px dashed #C9C4E6;border-radius:20px;background:#FAF9FF;color:#626B80;font:500 22px/1.4 var(--mc-font);text-align:center}
.widget-placeholder b{font-size:24px;color:var(--mc-ink)}
${C}{font-family:var(--mc-font);color:var(--mc-text);box-sizing:border-box;-webkit-font-smoothing:antialiased;letter-spacing:-.01em;line-height:1.5}
:is(${C}) *{box-sizing:border-box}
:is(${C}) button{font:inherit;color:inherit;cursor:pointer}
:is(${C}) [hidden],#search[hidden],#help[hidden],#dialog[hidden]{display:none!important}
:is(${C}) :focus-visible{outline:3px solid var(--mc-accent-2);outline-offset:2px}
.mc-i{width:20px;height:20px;flex:none;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
#nav-dock{position:fixed;left:50%;bottom:16px;z-index:1000;display:flex;align-items:center;gap:2px;padding:6px 8px;background:rgba(255,255,255,.96);border:1px solid var(--mc-line);border-radius:999px;box-shadow:var(--mc-shadow);transform:translateX(-50%);transition:opacity .25s ease,transform .25s ease,left .2s ease}
#nav-dock.idle{opacity:0;transform:translate(-50%,14px);pointer-events:none}
body.toc-open #nav-dock,body.toc-open #pen-toolbar{left:calc(280px + (100% - 280px)/2)}
body.notes-open #nav-dock,body.notes-open #pen-toolbar{left:calc((100% - 420px)/2)}
body.toc-open.notes-open #nav-dock,body.toc-open.notes-open #pen-toolbar{left:calc(280px + (100% - 700px)/2)}
#nav-dock .dock-btn{width:40px;height:40px;border:0;border-radius:50%;background:transparent;display:inline-flex;align-items:center;justify-content:center;color:var(--mc-muted);transition:background .15s,color .15s}
#nav-dock .dock-btn:hover{background:var(--mc-soft);color:var(--mc-accent)}
#nav-dock .dock-btn.on{background:var(--mc-accent);color:#fff}
#nav-dock .dock-btn:disabled{opacity:.35;cursor:default;background:transparent}
#nav-dock .mc-i{width:19px;height:19px}
#nav-count{min-width:78px;text-align:center;font:700 14px/1 var(--mc-mono);color:var(--mc-ink);letter-spacing:.04em}
#nav-dock .dock-sep,#pen-toolbar .pt-sep{width:1px;height:22px;background:var(--mc-line);margin:0 4px}
#toc-sidebar,#notes-panel{position:fixed;top:0;bottom:0;z-index:1002;display:flex;flex-direction:column;background:#fff;box-shadow:var(--mc-shadow);visibility:hidden;transition:transform .25s ease,visibility 0s linear .25s}
#toc-sidebar{left:0;width:280px;transform:translateX(-100%);border-right:1px solid var(--mc-line)}
#notes-panel{right:0;width:420px;transform:translateX(100%);border-left:4px solid var(--mc-accent);--notes-fs:15px}
#toc-sidebar.open,#notes-panel.open{transform:none;visibility:visible;transition-delay:0s}
:is(#toc-sidebar,#notes-panel) .panel-head{display:flex;align-items:center;gap:6px;padding:16px 14px 12px 20px;border-bottom:1px solid var(--mc-line)}
:is(#toc-sidebar,#notes-panel) .panel-tag{flex:1;font-size:12px;font-weight:800;letter-spacing:.1em;color:var(--mc-accent)}
:is(#toc-sidebar,#notes-panel) :is(.panel-close,.panel-btn){height:32px;min-width:32px;border:0;border-radius:8px;background:transparent;display:inline-flex;align-items:center;justify-content:center;color:var(--mc-muted);font-size:13px;font-weight:700}
:is(#toc-sidebar,#notes-panel) :is(.panel-close,.panel-btn):hover{background:var(--mc-soft);color:var(--mc-accent)}
#toc-sidebar .toc-count{font-size:12px;color:var(--mc-muted)}
#toc-sidebar .toc-list{flex:1;overflow:auto;padding:6px 10px 24px}
#toc-sidebar .toc-group{margin-top:8px}
#toc-sidebar .toc-group-head{padding:8px 10px 4px;font-size:11.5px;font-weight:800;letter-spacing:.04em;color:var(--mc-muted)}
#toc-sidebar .toc-item{display:flex;gap:10px;align-items:baseline;width:100%;padding:7px 10px;border:0;border-radius:8px;background:transparent;text-align:left;font-size:13.5px;line-height:1.45;color:var(--mc-text)}
#toc-sidebar .toc-item:hover{background:var(--mc-soft)}
#toc-sidebar .toc-item.active{background:var(--mc-accent);color:#fff}
#toc-sidebar .toc-num{flex:none;font:700 11px/1.7 var(--mc-mono);color:var(--mc-muted)}
#toc-sidebar .toc-item.active .toc-num{color:rgba(255,255,255,.8)}
#toc-sidebar :is(.toc-divider,.toc-cover) .toc-title{font-weight:700}
#notes-panel .notes-title{margin:14px 20px 2px;font-size:18px;line-height:1.4;font-weight:800;color:var(--mc-ink)}
#notes-panel .notes-time{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;margin:6px 20px 8px;font-size:13px;color:var(--mc-muted)}
#notes-panel .notes-time .mc-i{width:16px;height:16px;color:var(--mc-accent)}
#notes-panel .notes-time b{color:var(--mc-ink)}
#notes-panel .notes-total{margin-left:auto;padding:1px 8px;border-radius:999px;background:var(--mc-soft);font-size:12px}
#notes-panel .notes-body{flex:1;overflow:auto;padding:4px 20px 20px;font-size:var(--notes-fs);line-height:1.75}
#notes-panel .notes-empty{color:var(--mc-muted);font-style:italic}
#notes-panel .cue{margin:0 0 10px;padding:7px 12px;border-left:3px solid var(--mc-line);border-radius:0 10px 10px 0}
#notes-panel .cue-meta{display:flex;align-items:center;gap:8px;margin-bottom:2px}
#notes-panel .cue-k{padding:0 8px;border-radius:999px;background:var(--mc-soft);color:var(--mc-accent);font-size:11.5px;font-weight:800;letter-spacing:.03em}
#notes-panel .cue-id{font:11px var(--mc-mono);color:#9AA0B3}
#notes-panel .cue-wait{display:inline-flex;align-items:center;gap:3px;font-size:.85em;font-weight:700;color:#B35C00;white-space:nowrap}
#notes-panel .cue-wait .mc-i{width:14px;height:14px}
#notes-panel .cue-targets{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px}
#notes-panel .cue-targets span{padding:0 6px;border-radius:4px;background:#EEF3FF;color:#3656C9;font:11px/1.7 var(--mc-mono)}
#notes-panel .cue[data-focus]{cursor:help}
#notes-panel .cue.k-say{border-left-color:var(--mc-accent);background:#FAF9FF}
#notes-panel .cue.k-say .cue-t{font-size:1.05em;color:var(--mc-ink)}
#notes-panel .cue:is(.k-do,.k-look,.k-hop){border-left-color:#3E9CF5}
#notes-panel .cue:is(.k-do,.k-look,.k-hop) .cue-k{background:#E7F2FE;color:#1C6FC4}
#notes-panel .cue:is(.k-do,.k-look,.k-hop,.k-next,.k-screen) .cue-t{color:#4A5470}
#notes-panel .cue.k-ask{border-left-color:#F08C00;background:#FFF8EC}
#notes-panel .cue.k-ask .cue-k{background:#FFE8C2;color:#A35A00}
#notes-panel .cue.k-ask .cue-t{font-weight:600}
#notes-panel .cue:is(.k-sq,.k-sa,.k-tip){border-left-color:#12B886}
#notes-panel .cue:is(.k-sq,.k-sa,.k-tip) .cue-k{background:#DCF7EE;color:#087F5B}
#notes-panel .cue.k-sa{margin-left:16px}
#notes-panel .cue.k-wait{border-left-color:#FAB005}
#notes-panel .cue.k-screen{background:#F8F9FA;font-size:.93em}
#notes-panel .cue.k-verify{border-left-color:#E03131;background:#FFF5F5}
#notes-panel .cue.k-verify .cue-k{background:#FFE3E3;color:#C92A2A}
#notes-panel .notes-terms{margin-top:14px;padding-top:12px;border-top:1px solid var(--mc-line)}
#notes-panel .nt-head{margin-bottom:6px;font-size:11px;font-weight:800;letter-spacing:.1em;color:var(--mc-accent)}
#notes-panel .notes-terms dl{display:grid;grid-template-columns:auto 1fr;gap:6px 10px;margin:0}
#notes-panel .notes-terms dt{height:fit-content;padding:0 7px;border-radius:6px;background:var(--mc-soft);font:800 11.5px/1.7 var(--mc-mono);color:var(--mc-ink)}
#notes-panel .notes-terms dd{margin:0;font-size:12.5px;line-height:1.55;color:var(--mc-muted)}
#notes-panel .notes-next{padding:10px 20px 14px;border-top:1px solid var(--mc-line);font-size:13px;color:var(--mc-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#notes-panel .notes-next span{margin-right:8px;font-weight:800;color:var(--mc-accent)}
#search{position:fixed;top:72px;left:50%;z-index:1500;width:min(640px,calc(100vw - 32px));transform:translateX(-50%);background:#fff;border:1px solid var(--mc-line);border-radius:18px;box-shadow:var(--mc-shadow);overflow:hidden}
#search .search-box{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--mc-line);color:var(--mc-muted)}
#search-input{flex:1;min-width:0;border:0;outline:0!important;background:transparent;font:inherit;font-size:16px;color:var(--mc-text)}
#search kbd{padding:2px 6px;border:1px solid var(--mc-line);border-radius:4px;font:600 11px var(--mc-mono);color:var(--mc-muted)}
#search .search-results{max-height:min(60vh,560px);overflow:auto}
#search .sr-hint{margin:0;padding:18px 20px;font-size:13.5px;color:var(--mc-muted)}
#search .sr-head{padding:10px 18px;border-bottom:1px solid var(--mc-line);font-size:11.5px;font-weight:700;color:var(--mc-muted)}
#search .sr-head b{color:var(--mc-accent)}
#search .sr{display:flex;align-items:flex-start;gap:12px;width:100%;padding:12px 18px;border:0;border-bottom:1px solid #F0EEF7;background:#fff;text-align:left}
#search .sr:hover,#search .sr.sel{background:var(--mc-soft)}
#search .sr-no{flex:none;font:700 12px/1.7 var(--mc-mono);color:var(--mc-accent)}
#search .sr-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
#search .sr-title{font-size:14.5px;color:var(--mc-ink)}
#search .sr-snip{font-size:12.5px;line-height:1.55;color:var(--mc-muted);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
#search .sr-where{flex:none;padding:0 7px;border:1px solid var(--mc-line);border-radius:999px;font-size:11px;font-weight:700;color:var(--mc-muted)}
#search mark{padding:0 1px;border-radius:3px;background:#FFE588;color:inherit}
#help,#dialog{position:fixed;inset:0;z-index:2000;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(8,9,32,.55);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
:is(#help,#dialog) :is(.help-card,.dlg-card){display:flex;flex-direction:column;width:100%;max-width:min(760px,100%);max-height:calc(100vh - 48px);overflow:hidden;background:#fff;border-top:5px solid var(--mc-accent);border-radius:18px;box-shadow:0 30px 80px rgba(0,0,0,.35)}
#help .help-card{max-width:min(940px,100%)}
#help .help-cols{display:grid;grid-template-columns:1fr 1fr;gap:0 28px}
@media (max-width:760px){#help .help-cols{grid-template-columns:1fr}}
#dialog:is([data-kind=image],[data-kind=video],[data-kind=widget]) .dlg-card{max-width:min(1280px,100%)}
:is(#help,#dialog) .dlg-head{display:flex;align-items:center;gap:12px;padding:16px 20px;border-bottom:1px solid var(--mc-line)}
:is(#help,#dialog) .dlg-head h2{flex:1;margin:0;font-size:19px;line-height:1.35;font-weight:800;color:var(--mc-ink)}
:is(#help,#dialog) .dlg-close{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border:1px solid var(--mc-line);border-radius:999px;background:#fff;font-size:13px;font-weight:700;color:var(--mc-muted)}
:is(#help,#dialog) .dlg-close:hover{border-color:var(--mc-accent);color:var(--mc-accent)}
:is(#help,#dialog) .dlg-close .mc-i{width:16px;height:16px}
:is(#help,#dialog) :is(.dlg-body,.help-body){overflow:auto;padding:16px 22px 22px;font-size:15px;line-height:1.7}
:is(#help,#dialog) a{color:var(--mc-accent);text-decoration:none}
:is(#help,#dialog) a:hover{text-decoration:underline}
#dialog .dlg-image{display:block;width:100%;height:auto;max-height:calc(100vh - 220px);margin:0 auto;object-fit:contain;border-radius:10px;background:#F4F4F8}
#dialog .dlg-caption{margin:12px 0 0;text-align:center;font-size:13.5px;color:var(--mc-muted)}
#dialog .dlg-video{position:relative;aspect-ratio:16/9;overflow:hidden;border-radius:12px;background:#000}
#dialog .dlg-video iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
#dialog .dlg-note{margin:12px 0 0;font-size:13px;color:var(--mc-muted)}
#dialog .dlg-muted{color:var(--mc-muted)}
#dialog :is(.dlg-sources,.dlg-credits){display:flex;flex-direction:column;gap:8px;margin:0;padding:0;list-style:none}
#dialog .dlg-sources li{padding:9px 14px;border:1px solid var(--mc-line);border-radius:12px}
#dialog .dlg-sources small{display:block;font-size:12.5px;color:var(--mc-muted)}
#dialog .dlg-credits li{display:flex;flex-direction:column;gap:2px;padding-bottom:8px;border-bottom:1px solid var(--mc-line)}
#dialog .dlg-credits span{font-size:13.5px;color:var(--mc-muted)}
#dialog a.dlg-action{display:inline-block;padding:8px 16px;border-radius:999px;background:var(--mc-accent);color:#fff;font-weight:700}
#help .help-keys{width:100%;border-collapse:collapse;align-self:start;font-size:13.5px}
#help .help-keys th{padding:6px 8px;border-bottom:2px solid var(--mc-line);text-align:left;font-size:12px;color:var(--mc-muted)}
#help .help-keys td{padding:5px 8px;border-bottom:1px solid #F0EEF7;vertical-align:middle}
#help .help-keys td:first-child{width:48%;white-space:nowrap}
#help kbd{display:inline-block;min-width:24px;padding:1px 7px;border-radius:5px;background:var(--mc-ink);box-shadow:0 2px 0 rgba(0,0,0,.35);color:#fff;font:700 12px/1.6 var(--mc-mono);text-align:center}
#help .help-tip{margin:12px 0 0;font-size:13px;color:var(--mc-muted)}
#help .help-links{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
#help .help-link{padding:6px 14px;border:1px solid var(--mc-line);border-radius:999px;background:var(--mc-soft);font-size:13px;font-weight:700;color:var(--mc-ink)}
#help .help-link:hover{border-color:var(--mc-accent);color:var(--mc-accent)}
#help .help-about{flex:none;padding:10px 22px 14px;border-top:1px solid var(--mc-line);background:#FBFAFE;font-size:12.5px;color:var(--mc-muted)}
#help .help-about p{margin:2px 0}
#help .marco-attribution{font-weight:600;color:var(--mc-ink)}
#pen-toolbar{position:fixed;left:50%;bottom:78px;z-index:1001;display:flex;flex-direction:column;align-items:center;gap:8px;padding:10px 14px;background:#fff;border:1px solid var(--mc-line);border-radius:18px;box-shadow:var(--mc-shadow);transform:translateX(-50%);visibility:hidden;opacity:0;transition:opacity .15s,visibility 0s linear .15s,left .2s ease}
#pen-toolbar.open{visibility:visible;opacity:1;transition-delay:0s}
#pen-toolbar .pt-row{display:flex;align-items:center;gap:6px}
#pen-toolbar .tool-btn{width:36px;height:36px;display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--mc-line);border-radius:9px;background:#fff;color:var(--mc-text)}
#pen-toolbar .tool-btn .mc-i{width:18px;height:18px}
#pen-toolbar .tool-btn:hover{border-color:var(--mc-accent);color:var(--mc-accent)}
#pen-toolbar .tool-btn.on{border-color:transparent;background:var(--mc-accent);color:#fff}
#pen-toolbar .tool-btn.danger{color:var(--mc-danger)}
#pen-toolbar .color-btn{width:24px;height:24px;padding:0;border:2px solid #fff;border-radius:50%;box-shadow:0 0 0 1px var(--mc-line)}
#pen-toolbar .color-btn.on{box-shadow:0 0 0 2px var(--mc-accent);transform:scale(1.12)}
#pen-size{width:96px;accent-color:var(--mc-accent)}
#pen-size-v{min-width:22px;text-align:right;font:700 12px var(--mc-mono);color:var(--mc-muted)}
#marco-toast{position:fixed;left:50%;bottom:84px;z-index:2100;padding:8px 16px;border-radius:999px;background:rgba(26,27,77,.92);color:#fff;font-size:13.5px;font-weight:600;opacity:0;pointer-events:none;transform:translate(-50%,10px);transition:opacity .2s,transform .2s}
#marco-toast.on{opacity:1;transform:translate(-50%,0)}
html[data-edition=student] :is(#nav-notes,#notes-panel){display:none!important}
@media (prefers-reduced-motion:reduce){#canvas,${C}{transition:none!important}}
#handout{display:none}
#handout .ho-page{display:flex;flex-direction:column;gap:4mm;width:210mm;min-height:297mm;padding:12mm;box-sizing:border-box;background:#fff;color:#1F2133;font-family:var(--mc-font);break-after:page;page-break-after:always}
#handout .ho-page:last-child{break-after:auto;page-break-after:auto}
#handout .ho-head{display:flex;align-items:baseline;gap:4mm;padding-bottom:2mm;border-bottom:.4mm solid var(--mc-accent);font-size:9pt;color:#626B80}
#handout .ho-no{font-weight:800;color:var(--mc-accent)}
#handout .ho-title{flex:1;font-size:11pt;font-weight:800;color:#1A1B4D}
#handout .ho-shot{position:relative;flex:none;margin:0 auto;overflow:hidden;border:.3mm solid #D9D6EA;border-radius:2mm;background:#fff}
#handout .ho-shot>section.slide{display:var(--marco-slide-display,flex)!important;position:absolute!important;left:0!important;top:0!important;width:1920px!important;height:1080px!important;margin:0!important;transform-origin:0 0!important}
#handout .ho-note{font-size:9.5pt;line-height:1.6}
#handout .ho-note p{margin:0 0 1.6mm}
#handout .ho-k{color:var(--mc-accent)}
#handout .ho-cue:is(.k-screen,.k-do,.k-look,.k-hop,.k-next){color:#555E73}
#handout .ho-time{font-weight:700;color:#1A1B4D}
#handout .ho-empty{color:#8A90A2;font-style:italic}
#handout .ho-blank{flex:1;min-height:110mm;padding:2mm 4mm;border:.3mm solid #D9D6EA;border-radius:2mm;background:repeating-linear-gradient(#fff 0 9mm,#E6E3F2 9mm 9.3mm)}
#handout .ho-blank-label{padding:0 1mm;background:#fff;font-size:9pt;font-weight:700;color:#8A90A2}
#handout .ho-terms dl{display:grid;grid-template-columns:auto 1fr;gap:1.5mm 5mm;margin:0;font-size:9.5pt}
#handout .ho-terms dt{font-weight:800;color:#1A1B4D}
#handout .ho-terms dd{margin:0}
@media print{
*{-webkit-print-color-adjust:exact;print-color-adjust:exact}
${C},#pen-canvas,#laser-canvas,.ink-text,.slide-progress{display:none!important}
html,body{height:auto!important;overflow:visible!important;background:#fff!important}
body.print-lecture #stage{position:static!important;overflow:visible!important;background:none!important}
body.print-lecture #canvas{position:static!important;left:auto!important;top:auto!important;width:1920px!important;height:auto!important;transform:none!important;transition:none!important;background:none!important}
body.print-lecture #canvas>section.slide{display:var(--marco-slide-display,flex)!important;position:relative!important;left:auto!important;top:auto!important;width:1920px!important;height:1080px!important;opacity:1!important;transform:none!important;break-inside:avoid;break-after:page;page-break-after:always}
body.print-lecture #canvas>section.slide:last-of-type{break-after:auto;page-break-after:auto}
body.handout-mode{width:210mm;margin:0!important}
body.handout-mode #stage{display:none!important}
body.handout-mode #handout{display:block}
}
`
  .replace(/\n/g, '')
  .trim();
