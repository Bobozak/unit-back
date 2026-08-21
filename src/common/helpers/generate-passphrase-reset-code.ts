export function generatePassphraseResetCode(): string {
  let code = '';

  for (let i = 0; i < 16; i++) {
    code += String(Math.floor(Math.random() * 10));
  }

  return code;
}
