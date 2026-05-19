/**
 * Formatação de telefones com suporte internacional.
 *
 * Regras:
 * - Se o número vier com "+" (ex.: "+351 926 699 471"), respeitamos o código de país
 *   informado e NÃO adicionamos +55. Aceitamos 8 a 15 dígitos (E.164).
 * - Se o número já começar com um código de país internacional conhecido
 *   (qualquer coisa fora do padrão BR 10/11 dígitos), também preservamos.
 * - Caso contrário (10/11 dígitos típicos do Brasil ou sem "+"), aplicamos o
 *   default brasileiro (+55) para manter compatibilidade.
 */

// Lista mínima de prefixos internacionais comuns que devem ser preservados
// quando o número vier "puro" (sem "+"). Pode ser estendida conforme necessário.
const KNOWN_COUNTRY_CODES = [
  '1',   // EUA/Canadá
  '7',   // Rússia/Cazaquistão
  '20', '27', '30', '31', '32', '33', '34', '36', '39',
  '40', '41', '43', '44', '45', '46', '47', '48', '49',
  '51', '52', '53', '54', '56', '57', '58',
  '60', '61', '62', '63', '64', '65', '66',
  '81', '82', '84', '86', '90', '91', '92', '93', '94', '95', '98',
  '212', '213', '216', '218', '220', '221', '222', '223', '224', '225',
  '230', '231', '233', '234', '236', '237', '238', '239',
  '240', '241', '242', '243', '244', '245', '248', '249',
  '250', '251', '252', '253', '254', '255', '256', '257', '258', '260',
  '261', '262', '263', '264', '265', '266', '267', '268', '269',
  '297', '298', '299',
  '350', '351', '352', '353', '354', '355', '356', '357', '358', '359',
  '370', '371', '372', '373', '374', '375', '376', '377', '378', '380',
  '381', '382', '385', '386', '387', '389',
  '420', '421', '423',
  '500', '501', '502', '503', '504', '505', '506', '507', '508', '509',
  '590', '591', '592', '593', '594', '595', '596', '597', '598', '599',
  '670', '672', '673', '674', '675', '676', '677', '678', '679',
  '680', '681', '682', '683', '685', '686', '687', '688', '689',
  '850', '852', '853', '855', '856', '880', '886',
  '960', '961', '962', '963', '964', '965', '966', '967', '968',
  '970', '971', '972', '973', '974', '975', '976', '977',
  '992', '993', '994', '995', '996', '998',
];

/** Verifica se uma string de dígitos começa com algum prefixo internacional não-BR. */
function startsWithForeignCountryCode(digits: string): boolean {
  if (digits.startsWith('55')) return false; // BR
  // testa prefixos de 3, 2 e 1 dígitos
  for (const len of [3, 2, 1]) {
    const pref = digits.substring(0, len);
    if (KNOWN_COUNTRY_CODES.includes(pref)) return true;
  }
  return false;
}

/**
 * Formata e valida número de telefone.
 * - Aceita números brasileiros (adiciona 55 quando necessário)
 * - Aceita números internacionais quando informado com "+" ou prefixo de país conhecido
 */
export function formatPhoneNumber(phone: string): string {
  if (!phone) throw new Error('Número vazio');

  const hadPlus = String(phone).trim().startsWith('+');
  let cleaned = String(phone).replace(/\D/g, '');

  // Internacional explícito via "+"
  if (hadPlus) {
    if (cleaned.length < 8 || cleaned.length > 15) {
      throw new Error('Número internacional inválido (use 8 a 15 dígitos após o +)');
    }
    return cleaned;
  }

  // Remove zero de tronco se houver
  if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);

  // Já tem código de país estrangeiro conhecido
  if (startsWithForeignCountryCode(cleaned) && cleaned.length >= 8 && cleaned.length <= 15) {
    return cleaned;
  }

  // Default: Brasil
  if (!cleaned.startsWith('55')) cleaned = '55' + cleaned;

  if (cleaned.length < 12 || cleaned.length > 13) {
    throw new Error('Número inválido. Use o formato: (DDD) 9XXXX-XXXX ou inclua o código do país com "+"');
  }
  return cleaned;
}

/**
 * Versão segura que não lança erro - retorna string vazia se inválido
 */
export function safeFormatPhoneNumber(phone: string | undefined | null): string {
  if (!phone) return '';
  try {
    return formatPhoneNumber(phone);
  } catch {
    return String(phone).replace(/\D/g, '');
  }
}

/**
 * Formata número de telefone de forma robusta, com suporte internacional.
 * Retorna { formatted, isValid }.
 */
export function robustFormatPhoneNumber(phone: string | undefined | null): { formatted: string; isValid: boolean } {
  if (!phone || typeof phone !== 'string') {
    return { formatted: '', isValid: false };
  }

  const hadPlus = phone.trim().startsWith('+');
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 0) return { formatted: '', isValid: false };

  // Internacional explícito
  if (hadPlus) {
    const ok = cleaned.length >= 8 && cleaned.length <= 15;
    return { formatted: cleaned, isValid: ok };
  }

  if (cleaned.startsWith('0') && cleaned.length > 10) {
    cleaned = cleaned.substring(1);
  }

  // BR já com 55
  if (cleaned.startsWith('55') && (cleaned.length === 12 || cleaned.length === 13)) {
    return { formatted: cleaned, isValid: true };
  }

  // Internacional sem "+": preserva se começa com código de país conhecido
  if (startsWithForeignCountryCode(cleaned) && cleaned.length >= 8 && cleaned.length <= 15) {
    return { formatted: cleaned, isValid: true };
  }

  // Heurística BR
  if (cleaned.length === 10 || cleaned.length === 11) {
    return { formatted: '55' + cleaned, isValid: true };
  }
  if (cleaned.length === 12 || cleaned.length === 13) {
    if (cleaned.startsWith('55')) return { formatted: cleaned, isValid: true };
    // Pode ser internacional sem "+"; aceita como E.164
    return { formatted: cleaned, isValid: true };
  }
  if (cleaned.length >= 8 && cleaned.length <= 15) {
    return { formatted: cleaned, isValid: true };
  }
  return { formatted: cleaned, isValid: false };
}

/**
 * Normaliza número para comparação. Preserva código de país internacional quando
 * detectado; caso contrário aplica default BR.
 */
export function normalizePhoneForComparison(phone: string | null | undefined): string {
  if (!phone) return '';
  const hadPlus = String(phone).trim().startsWith('+');
  let digits = String(phone).replace(/\D/g, '');
  if (hadPlus) return digits;
  if (digits.startsWith('0')) digits = digits.substring(1);
  if (digits.startsWith('55')) return digits;
  if (startsWithForeignCountryCode(digits) && digits.length >= 8) return digits;
  if (digits.length >= 10 && digits.length <= 11) return `55${digits}`;
  return digits;
}

/**
 * Formata para exibição. Para números BR mantém padrão local; demais retornam
 * "+<code> <restante>" simples.
 */
export function displayPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');

  if (cleaned.startsWith('55') && cleaned.length === 13) {
    return `+${cleaned.substring(0, 2)} (${cleaned.substring(2, 4)}) ${cleaned.substring(4, 9)}-${cleaned.substring(9)}`;
  }
  if (cleaned.startsWith('55') && cleaned.length === 12) {
    return `+${cleaned.substring(0, 2)} (${cleaned.substring(2, 4)}) ${cleaned.substring(4, 8)}-${cleaned.substring(8)}`;
  }

  // Internacional genérico
  if (cleaned.length >= 8 && cleaned.length <= 15) {
    for (const len of [3, 2, 1]) {
      const pref = cleaned.substring(0, len);
      if (KNOWN_COUNTRY_CODES.includes(pref)) {
        return `+${pref} ${cleaned.substring(len)}`;
      }
    }
    return `+${cleaned}`;
  }
  return phone;
}
