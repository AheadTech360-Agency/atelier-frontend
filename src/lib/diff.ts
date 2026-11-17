export type DiffPart = { kind: "same" | "add" | "del"; text: string };

/**
 * Line diff between two drafts (longest common subsequence). Drafts are short, but very long
 * ones fall back to "all removed, all added" so the page never freezes.
 */
export function diffLines(a: string, b: string): DiffPart[] {
  const x = a.split("\n");
  const y = b.split("\n");
  if (x.length * y.length > 400_000) {
    return [...x.map((t) => ({ kind: "del" as const, text: t })), ...y.map((t) => ({ kind: "add" as const, text: t }))];
  }
  // lcs[i][j] = length of the common subsequence of x[i..] and y[j..]
  const lcs: number[][] = Array.from({ length: x.length + 1 }, () => new Array<number>(y.length + 1).fill(0));
  for (let i = x.length - 1; i >= 0; i--) {
    for (let j = y.length - 1; j >= 0; j--) {
      lcs[i][j] = x[i] === y[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const out: DiffPart[] = [];
  let i = 0;
  let j = 0;
  while (i < x.length && j < y.length) {
    if (x[i] === y[j]) {
      out.push({ kind: "same", text: x[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      out.push({ kind: "del", text: x[i++] });
    } else {
      out.push({ kind: "add", text: y[j++] });
    }
  }
  while (i < x.length) out.push({ kind: "del", text: x[i++] });
  while (j < y.length) out.push({ kind: "add", text: y[j++] });
  return out;
}
