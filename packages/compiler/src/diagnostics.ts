/** A parse, validation or build message with an optional source location. */
export interface Diagnostic {
  level: 'error' | 'warn' | 'info';
  /** Machine-readable code: `format.*` (parser), `schema.*` (validator), `asset.*`, `font.*`, `icon.*`, `build.*`. */
  code: string;
  message: string;
  file?: string;
  /** 1-based line in `file`. */
  line?: number;
  /** Slide id, when the message belongs to one slide. */
  slide?: string;
}

export type DiagnosticSink = (d: Diagnostic) => void;

export function hasErrors(list: readonly Diagnostic[]): boolean {
  return list.some((d) => d.level === 'error');
}

/** `file:line: level [code] message` — the format editors and CI logs understand. */
export function formatDiagnostic(d: Diagnostic): string {
  const loc = d.file ? `${d.file}${d.line ? `:${d.line}` : ''}: ` : d.line ? `line ${d.line}: ` : '';
  return `${loc}${d.level} [${d.code}] ${d.message}`;
}
