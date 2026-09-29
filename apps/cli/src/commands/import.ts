import { existsSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { runImport, type RunImportOptions, type RunImportResult } from '@marco/importer';
import { type CliIo, displayPath, formatBytes, paint } from '../output.js';

export type ImportFamily = 'auto' | 'v20' | 'v97';
export const IMPORT_FAMILIES: readonly ImportFamily[] = ['auto', 'v20', 'v97'];

export interface ImportCommandOptions {
  /** Legacy deck family; `auto` detects V20 vs v9.7 markup. */
  family?: ImportFamily;
  /** Refresh assets, sidecars, manifest and report but keep an existing lecture.marco.md. */
  keepSource?: boolean;
  /** Asset folder inside outDir (default `assets`). */
  assetDir?: string;
}

const FAMILY_LABEL: Record<'v20' | 'v97', string> = { v20: 'V20 덱', v97: 'v9.7 덱' };

/** `marco import <legacy.html> <outDir>` → `runImport` from @marco/importer. */
export async function runImportCommand(
  input: string,
  outDir: string,
  opts: ImportCommandOptions,
  io: CliIo,
): Promise<{ code: number; result?: RunImportResult }> {
  const source = resolve(io.cwd, input);
  if (!existsSync(source) || !statSync(source).isFile()) {
    io.err(`${paint(io, 'red', '오류')} 파일이 없습니다: ${input}`);
    return { code: 1 };
  }
  const out = resolve(io.cwd, outDir);
  if (existsSync(out) && !statSync(out).isDirectory()) {
    io.err(`${paint(io, 'red', '오류')} 출력 위치가 폴더가 아니라 파일입니다: ${outDir}`);
    return { code: 1 };
  }
  const sourceFile = join(out, 'lecture.marco.md');
  const keepSource = opts.keepSource === true;
  const runOpts: RunImportOptions = { writeSource: !keepSource };
  if (opts.family && opts.family !== 'auto') runOpts.family = opts.family;
  if (opts.assetDir) runOpts.assetDir = opts.assetDir;

  let res: RunImportResult;
  try {
    res = await runImport(source, out, runOpts);
  } catch (e) {
    io.err(`${paint(io, 'red', '오류')} 가져오기 실패: ${(e as Error).message}`);
    return { code: 1 };
  }
  const r = res.result.report;
  const blocks = r.mappedBlocks + r.fallbackBlocks;
  io.out(
    `${paint(io, 'green', '✓')} ${paint(io, 'bold', displayPath(io, source))} → ${paint(io, 'bold', displayPath(io, out))} · ${
      FAMILY_LABEL[r.family]
    } · 슬라이드 ${r.slideCount}장 · 블록 ${blocks}개 (컴포넌트 ${r.mappedPercent}% · html ${r.fallbackBlocks}) · 이미지 ${
      r.assets.total
    }개 ${formatBytes(r.assets.bytes)}`,
  );
  for (const f of res.files) io.out(paint(io, 'dim', `  ${f}`));
  if (keepSource) {
    io.out(
      existsSync(sourceFile)
        ? `  ${paint(io, 'cyan', '--keep-source')} ${displayPath(io, sourceFile)}는 그대로 두었습니다.`
        : `${paint(io, 'yellow', '경고')} --keep-source: ${displayPath(io, sourceFile)}가 없어 원고를 쓰지 않았습니다. 옵션 없이 다시 실행하세요.`,
    );
  }
  if (r.assets.stripped) {
    io.out(
      `${paint(io, 'yellow', '경고')} 이미지 ${r.assets.stripped}개는 원본에 데이터가 없어(<STRIPPED>) 파일을 만들지 못했습니다.`,
    );
  }
  if (r.validation.length) {
    io.out(
      `${paint(io, 'yellow', '경고')} IR 검증 오류 ${r.validation.length}건 · 자세한 내용은 IMPORT-REPORT.md`,
    );
  }
  for (const w of r.warnings.slice(0, 5)) io.out(`${paint(io, 'yellow', '경고')} ${w}`);
  if (r.warnings.length > 5)
    io.out(paint(io, 'dim', `  … 경고 ${r.warnings.length - 5}건 더 (IMPORT-REPORT.md)`));
  io.out(
    `  다음: ${paint(io, 'cyan', `marco build ${displayPath(io, sourceFile)}`)}  ·  보고서: ${displayPath(io, join(out, 'IMPORT-REPORT.md'))}`,
  );
  return { code: 0, result: res };
}
