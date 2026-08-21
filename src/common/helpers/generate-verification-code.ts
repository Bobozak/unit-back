const CODE_LENGTH = 16;
const MIN_DISTINCT_DIGITS = 8;
const MAX_DISTINCT_DIGITS = 10;

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function generateVerificationCode(): string {
  const distinctCount =
    MIN_DISTINCT_DIGITS +
    Math.floor(Math.random() * (MAX_DISTINCT_DIGITS - MIN_DISTINCT_DIGITS + 1));

  const chosen = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    .slice(0, distinctCount)
    .sort((a, b) => a - b);

  const slots: number[] = [...chosen];
  const remaining = CODE_LENGTH - distinctCount;

  for (let i = 0; i < remaining; i += 1) {
    slots.push(chosen[Math.floor(Math.random() * chosen.length)]);
  }

  slots.sort((a, b) => a - b);
  return slots.map(String).join('');
}
