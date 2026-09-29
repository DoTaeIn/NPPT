# assets

강의에 쓰는 이미지를 이 폴더에 넣습니다. `marco build`가 이미지를 최적화해
HTML 한 파일 안에 넣으므로, 이 폴더를 따로 배포할 필요는 없습니다.

## 본문에서 바로 쓰기

```markdown
![이미지 설명(대체 텍스트)](assets/campus.png '그림 아래 캡션')
```

파일 이름에서 자산 id(`campus`)가 자동으로 만들어집니다.

## 출처와 함께 쓰기

머리말(front matter)의 `assets`에 제목·출처를 적으면 덱의 "이미지·영상 출처" 창에 표시됩니다.

```yaml
assets:
  campus:
    path: assets/campus.png
    title: 캠퍼스 전경
    credit: 촬영 홍길동
    source: https://example.com/original
    alt: 캠퍼스 정문과 본관
```

본문에서는 `:::image asset=campus caption="캡션" zoom` 으로 불러옵니다.

- 1920×1080보다 큰 이미지는 자동으로 줄어듭니다.
- JPEG는 품질 82로, 색이 많은 PNG는 WebP로 바뀝니다(`--keep-png`로 PNG 유지).
- 투명 배경이 있거나 256색 이하인 PNG는 PNG로 남습니다.
