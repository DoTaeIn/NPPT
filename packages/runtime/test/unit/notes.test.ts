import { describe, expect, it } from 'vitest';
import { CUE_LABEL } from '../../src/labels';
import { $, autoDispose, boot } from './helpers';

autoDispose();

const panel = (): HTMLElement => $('#notes-panel')!;

describe('notes panel', () => {
  it('renders cues by kind with Korean marker labels, ids, wait and focus targets', () => {
    const m = boot();
    m.next();
    m.toggleNotes();
    expect(panel().classList.contains('open')).toBe(true);
    expect($('#notes-panel .panel-tag')?.textContent).toBe('발표 노트 · 02 / 05');
    expect($('#notes-panel .notes-title')?.textContent).toBe(
      '카드 인식, 허용, 문 열림, 사람 통과는 다른 단계다',
    );
    expect($('#notes-panel .notes-time')?.textContent).toContain('2.5분 · 01:00 – 03:30');
    expect($('#notes-panel .notes-total')?.textContent).toBe('누적 3.5분 / 10분');
    const labels = Array.from(document.querySelectorAll('#notes-panel .cue-k')).map(
      (e) => e.textContent,
    );
    expect(labels).toEqual(['화면', '대사', '주목', '발문', '예상질문', '예상답변', '전환']);
    const say = $('#notes-panel .cue.k-say')!;
    expect(say.dataset.cueId).toBe('p02-c001');
    expect(say.querySelector('.cue-t')?.innerHTML).toContain('<b>네 단계</b>');
    expect($('#notes-panel .cue.k-ask .cue-wait')?.textContent).toBe('10초');
    expect($('#notes-panel .cue.k-look .cue-targets')?.textContent).toBe('@s-02-b1');
    expect($('#notes-panel .notes-terms')?.textContent).toContain('PACS');
    expect($('#notes-panel .notes-terms')?.textContent).toContain('RBAC');
    expect($('#notes-panel .notes-next')?.textContent).toContain('03 · 사옥의 3선 방어 개념도');
  });

  it('follows slide changes and shows authored marker aliases', () => {
    const m = boot();
    m.toggleNotes();
    m.go(2);
    const labels = Array.from(document.querySelectorAll('#notes-panel .cue-k')).map(
      (e) => e.textContent,
    );
    expect(labels).toEqual(['조작', '이동', '팁', '대기', '검증 보충', '메모']);
    m.go(4);
    expect($('#notes-panel .notes-empty')?.textContent).toContain('노트가 없습니다');
    expect($('#notes-panel .notes-next')?.textContent).toBe('마지막 슬라이드');
  });

  it('highlights focus targets while hovering a cue', () => {
    const m = boot();
    m.next();
    m.toggleNotes();
    const cue = $('#notes-panel .cue.k-look')!;
    cue.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect($('#s-02-b1')?.classList.contains('marco-focus')).toBe(true);
    cue.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
    expect($('#s-02-b1')?.classList.contains('marco-focus')).toBe(false);
  });

  it('has a label for every cue kind', () => {
    expect(Object.keys(CUE_LABEL)).toHaveLength(13);
    expect(CUE_LABEL.SAY).toBe('대사');
    expect(CUE_LABEL.SCREEN).toBe('화면');
  });

  it('close button closes the panel', () => {
    const m = boot();
    m.toggleNotes();
    $<HTMLButtonElement>('#notes-panel .panel-close')?.click();
    expect(document.body.classList.contains('notes-open')).toBe(false);
  });
});
