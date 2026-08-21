export function buildResetRound1ExpectedSequence(code: string): string {
  const values = [...code].map((char) => Number(char));
  const evenAsc = values
    .filter((digit) => digit !== 0 && digit % 2 === 0)
    .sort((a, b) => a - b);
  const oddDesc = values
    .filter((digit) => digit % 2 === 1)
    .sort((a, b) => b - a);
  const zeros = values.filter((digit) => digit === 0);

  return [...evenAsc, ...oddDesc, ...zeros].join('');
}

export function buildResetRound2ExpectedSequence(code: string): string {
  return code;
}
