const MICROS_PER_UNIT = 1_000_000;

export function toMoneyMicros(amount: number): number {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("TokenU money amount must be a finite non-negative number");
  }

  const micros = Math.round(amount * MICROS_PER_UNIT);

  if (!Number.isSafeInteger(micros)) {
    throw new Error("TokenU money amount exceeds safe integer micros range");
  }

  return micros;
}

export function fromMoneyMicros(micros: number): number {
  if (!Number.isSafeInteger(micros) || micros < 0) {
    throw new Error("Invalid TokenU money micros value");
  }

  return micros / MICROS_PER_UNIT;
}
