declare module 'subset-font' {
  interface SubsetFontOptions {
    targetFormat?: 'woff2' | 'woff' | 'truetype' | 'sfnt';
    preserveNameIds?: number[];
    variationAxes?: Record<string, number | { min: number; max: number; default?: number }>;
    noLayoutClosure?: boolean;
  }
  export default function subsetFont(
    font: Buffer | Uint8Array,
    text: string,
    options?: SubsetFontOptions,
  ): Promise<Buffer>;
}
