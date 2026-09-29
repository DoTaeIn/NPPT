// Sources dialog, media credits, image popup and video (docs/spec/runtime.md §6).
import { openDialog } from './chrome/dialog';
import { esc, h, linkHtml } from './dom';
import { S, listen } from './state';

const NET = '<p class="dlg-note">외부 링크와 영상은 인터넷 연결이 필요합니다.</p>';

export function sourcesHtml(ids: string[]): string {
  if (!ids.length) return '<p class="dlg-note">등록된 출처가 없습니다.</p>';
  const items = ids.map((id) => {
    const r = S.data.refs.find((x) => x.id === id);
    if (!r)
      return `<li><b>${esc(id)}</b> · <span class="dlg-muted">참고 목록에 없는 출처</span></li>`;
    const note = r.note ? `<small>${esc(r.note)}</small>` : '';
    return `<li>${linkHtml(r.url, `<b>${esc(r.id)}</b> · ${esc(r.title)}`)}${note}</li>`;
  });
  return `<ol class="dlg-sources">${items.join('')}</ol>${NET}`;
}

/** `slideId` = a slide id from `slideRefs`, or `'all'` for every ref. */
export function openSources(slideId: string): void {
  const all = slideId === 'all';
  const ids = all ? S.data.refs.map((r) => r.id) : S.data.slideRefs[slideId] || [];
  openDialog(all ? '모든 출처' : '참고 출처', sourcesHtml(ids), 'sources');
}

export function openMediaCredits(): void {
  const assets = Object.keys(S.data.assets).map((id) => {
    const a = S.data.assets[id]!;
    const src = a.source ? ` · ${linkHtml(a.source, '원문 ↗')}` : '';
    return `<li><b>${esc(a.title || id)}</b><span>${esc(a.credit || '출처 표기 없음')}${src}</span></li>`;
  });
  const videos = S.data.videos.map((v) => {
    const watch = `https://www.youtube.com/watch?v=${encodeURIComponent(v.id)}`;
    return `<li><b>영상 · ${esc(v.title)}</b><span>${esc(v.credit || 'YouTube')} · ${linkHtml(watch, 'YouTube ↗')}</span></li>`;
  });
  const list = assets.concat(videos);
  openDialog(
    '이미지·영상 출처',
    (list.length
      ? `<ul class="dlg-credits">${list.join('')}</ul>`
      : '<p class="dlg-note">등록된 미디어가 없습니다.</p>') +
      '<p class="dlg-note">이미지는 이 HTML 파일에 내장되어 있습니다. 외부 원문과 영상은 인터넷 연결이 필요합니다.</p>',
    'media',
  );
}

/** Image popup: reads the `<img>` of `figure[data-asset=id]` on the slide; no second copy is stored. */
export function openImage(assetId: string, from?: Element | null): void {
  const slide = from?.closest('section.slide') || S.slides[S.cur];
  const find = (root: ParentNode | undefined | null): HTMLImageElement | null => {
    for (const f of Array.from(root?.querySelectorAll<HTMLElement>('figure[data-asset]') || [])) {
      if (f.dataset.asset === assetId) return f.querySelector('img');
    }
    return null;
  };
  const img = find(slide) || find(document);
  const meta = S.data.assets[assetId] || {};
  const title = meta.title || img?.alt || '이미지';
  if (!img) {
    openDialog(title, '<p class="dlg-note">이미지를 찾을 수 없습니다.</p>', 'image');
    return;
  }
  const frag = document.createDocumentFragment();
  frag.append(
    h('img', {
      class: 'dlg-image',
      src: img.getAttribute('src') || img.currentSrc,
      alt: meta.alt || img.alt || title,
    }),
  );
  const credit = [
    meta.credit ? esc(meta.credit) : '',
    meta.source ? linkHtml(meta.source, '출처 원문 ↗') : '',
  ]
    .filter(Boolean)
    .join(' · ');
  if (credit) frag.append(h('p', { class: 'dlg-caption' }, credit));
  openDialog(title, frag, 'image');
}

/**
 * YouTube id → embed in the dialog, or a new window when opened from file:// (embeds are blocked
 * there). `start` defaults to the video's `start` in `#lecture-data`.
 */
export function openVideo(id: string, start?: number): void {
  if (!/^[\w-]{6,20}$/.test(id)) return;
  const v = S.data.videos.find((x) => x.id === id);
  const s = Math.max(0, Math.floor(start ?? v?.start ?? 0) || 0);
  const title = v?.title || 'YouTube 영상';
  const watch = `https://www.youtube.com/watch?v=${id}&t=${s}s`;
  const credit = v?.credit ? `<p class="dlg-caption">${esc(v.credit)}</p>` : '';
  const link = `<a class="dlg-action" href="${watch}" target="_blank" rel="noopener noreferrer">YouTube에서 재생 ↗</a>`;
  if (location.protocol === 'file:') {
    window.open(watch, '_blank', 'noopener,noreferrer');
    openDialog(
      title,
      '<p class="dlg-note">강의 파일을 직접 열었을 때는 영상을 내장 재생할 수 없어 새 창에서 엽니다. 창이 보이지 않으면 아래 버튼을 누르세요.</p>' +
        `<p>${link}</p>${credit}<p class="dlg-note">영상은 인터넷 연결이 필요합니다.</p>`,
      'video',
    );
    return;
  }
  const src = `https://www.youtube-nocookie.com/embed/${id}?start=${s}&autoplay=1&rel=0&playsinline=1`;
  openDialog(
    title,
    `<div class="dlg-video"><iframe src="${src}" title="${esc(title)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>` +
      `${credit}<p class="dlg-note">영상은 인터넷 연결이 필요합니다. 창을 닫으면 재생이 멈춥니다. ${link}</p>`,
    'video',
  );
}

export function initMedia(): void {
  listen<MouseEvent>(document, 'click', (e) => {
    const t = e.target as Element | null;
    if (!t?.closest) return;
    const src = t.closest<HTMLElement>('.source-link[data-source]');
    if (src) {
      e.preventDefault();
      openSources(src.dataset.source || '');
      return;
    }
    const img = t.closest<HTMLElement>('.image-open[data-asset]');
    if (img) {
      e.preventDefault();
      openImage(img.dataset.asset || '', img);
      return;
    }
    const vid = t.closest<HTMLElement>('.video-open[data-video]');
    if (vid) {
      e.preventDefault();
      const st = vid.dataset.start;
      openVideo(vid.dataset.video || '', st ? Number(st) : undefined);
    }
  });
}
