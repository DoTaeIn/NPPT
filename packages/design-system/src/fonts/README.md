# Fonts

The two families the MARCO design system embeds. Both are licensed under the
**SIL Open Font License 1.1**; the full licence texts with each family's copyright
notice are in [`OFL.txt`](OFL.txt), fetched verbatim from the upstream repositories.

| File                         | Family (name table)     | Weight (CSS) | Version |
| ---------------------------- | ----------------------- | ------------ | ------- |
| `Pretendard-Regular.woff2`   | Pretendard              | 400          | 1.309   |
| `Pretendard-Medium.woff2`    | Pretendard Medium       | 500          | 1.309   |
| `Pretendard-SemiBold.woff2`  | Pretendard SemiBold     | 600          | 1.309   |
| `Pretendard-Bold.woff2`      | Pretendard              | 700–900      | 1.309   |
| `SpoqaHanSans-Regular.woff2` | Spoqa Han Sans Neo      | 400          | 1.100   |
| `SpoqaHanSans-Medium.woff2`  | Spoqa Han Sans Neo Med. | 500          | 1.100   |
| `SpoqaHanSans-Bold.woff2`    | Spoqa Han Sans Neo Bold | 700–900      | 1.100   |

- **Pretendard**, © 2021–2023 Kil Hyung-jin, Reserved Font Name "Pretendard".
  Upstream: <https://github.com/orioncactus/pretendard>
- **Spoqa Han Sans Neo**, © 2020 Spoqa, Reserved Font Names "Spoqa Han Sans",
  "Spoqa Han Sans JP", "Spoqa Han Sans Neo". Upstream: <https://github.com/spoqa/spoqa-han-sans>

## Provenance

The files were extracted byte-for-byte from the base64 `@font-face` rules of the
professor's v9.7 deck (`reference/decks/week05-firewall-v9.7.html`); nothing was
re-encoded. They are the builds that deck shipped:

- Pretendard: a subset build with Latin, Greek, Cyrillic, symbols and 2,780 precomposed
  Hangul syllables (KS X 1001 plus common extras), about 267 KB per weight.
- Spoqa Han Sans Neo: a Latin-only subset (Basic Latin and a few punctuation marks,
  about 7 KB per weight) used for numerals. `--font-num` puts Pretendard after it, so
  Korean text in that stack falls through to Pretendard.

The CSS family name `SpoqaHanSans` follows the v9.7 deck's `@font-face` alias.

## Licence notes for the build

- `dist/marco.css` embeds the files as data URLs and keeps a `/*! … */` notice naming
  both families and the licence; keep it when the CSS is inlined into a deck.
- Subsetting produces Modified Versions under OFL §3. Upstream's own subset builds keep
  the family names; the compiler should keep the copyright and licence metadata of the
  source files in its subsets and carry the notice above.
