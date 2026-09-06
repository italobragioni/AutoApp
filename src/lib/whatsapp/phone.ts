/**
 * Normalização de telefone para E.164 (Brasil).
 *
 * Os telefones do AUTOVOLT são texto livre. Só na hora do envio o número é
 * normalizado; quando não dá para formar um número válido, retorna null e a
 * automação registra "sem número válido" em vez de enviar.
 */
export function normalizePhoneBR(raw?: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  // Já com código do país (55 + DDD + número): 12 ou 13 dígitos.
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return `+${digits}`;
  }
  // Só DDD + número (10 fixo / 11 celular): adiciona o Brasil.
  if (digits.length === 10 || digits.length === 11) {
    return `+55${digits}`;
  }
  // Outro país já com DDI plausível.
  if (digits.length === 12 || digits.length === 13) {
    return `+${digits}`;
  }
  return null;
}

/** Mascara o número para exibição no histórico (mantém DDI/DDD e finais). */
export function maskPhone(phone?: string | null): string {
  if (!phone) return "—";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 6) return "•••";
  const start = phone.startsWith("+") ? `+${digits.slice(0, 4)}` : digits.slice(0, 4);
  const end = digits.slice(-2);
  return `${start} ••••• ${end}`;
}
