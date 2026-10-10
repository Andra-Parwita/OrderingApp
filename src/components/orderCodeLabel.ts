/** "K7F2QX" read out character by character for screen readers: "K 7 F, 2 Q X" (spec §9). */
export function orderCodeLabel(code: string): string {
  const chars = code.replace(/[\s-]/g, '').toUpperCase().split('');
  return [chars.slice(0, 3).join(' '), chars.slice(3).join(' ')].filter(Boolean).join(', ');
}
