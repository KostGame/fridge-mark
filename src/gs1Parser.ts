const GROUP_SEPARATOR = String.fromCharCode(29);
const SYMBOLOGY_PREFIX_RE = /^\]d2/i;

export type Gs1Confidence = 'high' | 'medium' | 'low';

export interface UnknownGs1Ai {
  ai: string;
  value: string;
}

export interface ParsedGs1Code {
  raw: string;
  normalized: string;
  symbologyIdentifier?: string;
  gtin?: string;
  batch?: string;
  serial?: string;
  productionDate?: string;
  bestBeforeDate?: string;
  expiryDate?: string;
  expiryDateTime?: string;
  unknownAis: UnknownGs1Ai[];
  errors: string[];
  confidence: Gs1Confidence;
}

type KnownAi = '01' | '10' | '11' | '15' | '17' | '21' | '7003';

const FIXED_AI_LENGTHS: Record<Exclude<KnownAi, '10' | '21'>, number> = {
  '01': 14,
  '11': 6,
  '15': 6,
  '17': 6,
  '7003': 10,
};

const VARIABLE_AI_MAX_LENGTHS: Record<Extract<KnownAi, '10' | '21'>, number> = {
  '10': 20,
  '21': 20,
};

const KNOWN_AIS: KnownAi[] = ['7003', '01', '11', '15', '17', '10', '21'];

export function normalizeGs1Raw(raw: string): string {
  return raw.trim().replace(/\\u001d/gi, GROUP_SEPARATOR);
}

export function parseGs1DateYYMMDD(value: string): string | null {
  if (!/^\d{6}$/.test(value)) {
    return null;
  }

  const yy = Number(value.slice(0, 2));
  const month = Number(value.slice(2, 4));
  const day = Number(value.slice(4, 6));
  const year = yy < 50 ? 2000 + yy : 1900 + yy;

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function parseGs1DateTimeYYMMDDhhmm(value: string): string | null {
  if (!/^\d{10}$/.test(value)) {
    return null;
  }

  const date = parseGs1DateYYMMDD(value.slice(0, 6));
  const hour = Number(value.slice(6, 8));
  const minute = Number(value.slice(8, 10));

  if (!date || hour > 23 || minute > 59) {
    return null;
  }

  return `${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function parseGs1Code(raw: string): ParsedGs1Code {
  const normalizedRaw = normalizeGs1Raw(raw);
  const result: ParsedGs1Code = {
    raw,
    normalized: normalizedRaw,
    unknownAis: [],
    errors: [],
    confidence: 'low',
  };

  if (!normalizedRaw) {
    result.errors.push('Пустая строка кода.');
    return result;
  }

  let body = normalizedRaw;
  const symbologyMatch = body.match(SYMBOLOGY_PREFIX_RE);
  if (symbologyMatch) {
    result.symbologyIdentifier = symbologyMatch[0];
    body = body.slice(symbologyMatch[0].length);
  }

  if (body.includes('(')) {
    parseBracketedBody(body, result);
  } else {
    parsePlainBody(body, result);
  }

  result.confidence = getConfidence(result);
  return result;
}

function parseBracketedBody(body: string, result: ParsedGs1Code): void {
  const tokenRe = /\((\d{2,4})\)([^\(]*)/g;
  let matched = false;
  let match: RegExpExecArray | null;

  while ((match = tokenRe.exec(body))) {
    matched = true;
    applyAi(match[1], match[2].split(GROUP_SEPARATOR).join(''), result);
  }

  if (!matched) {
    result.errors.push('Не удалось найти AI в формате с круглыми скобками.');
  }
}

function parsePlainBody(body: string, result: ParsedGs1Code): void {
  let index = 0;

  while (index < body.length) {
    if (body[index] === GROUP_SEPARATOR) {
      index += 1;
      continue;
    }

    const ai = findKnownAi(body, index);
    if (ai) {
      const valueStart = index + ai.length;
      const valueEnd = isVariableAi(ai) ? findVariableEnd(body, valueStart, VARIABLE_AI_MAX_LENGTHS[ai]) : valueStart + FIXED_AI_LENGTHS[ai];
      const value = body.slice(valueStart, valueEnd);
      applyAi(ai, value, result);
      index = body[valueEnd] === GROUP_SEPARATOR ? valueEnd + 1 : valueEnd;
      continue;
    }

    const unknownMatch = body.slice(index).match(/^(\d{2,4})/);
    if (!unknownMatch) {
      result.errors.push(`Не удалось определить AI около позиции ${index}.`);
      break;
    }

    const unknownAi = unknownMatch[1];
    const valueStart = index + unknownAi.length;
    const valueEnd = findVariableEnd(body, valueStart, 20);
    result.unknownAis.push({
      ai: unknownAi,
      value: body.slice(valueStart, valueEnd),
    });
    index = body[valueEnd] === GROUP_SEPARATOR ? valueEnd + 1 : valueEnd;
  }
}

function findKnownAi(body: string, index: number): KnownAi | undefined {
  return KNOWN_AIS.find((ai) => body.startsWith(ai, index));
}

function isVariableAi(ai: KnownAi): ai is '10' | '21' {
  return ai === '10' || ai === '21';
}

function findVariableEnd(body: string, start: number, maxLength: number): number {
  const limit = Math.min(body.length, start + maxLength);
  const separatorIndex = body.indexOf(GROUP_SEPARATOR, start);
  if (separatorIndex >= start && separatorIndex <= limit) {
    return separatorIndex;
  }

  for (let index = start + 1; index < limit; index += 1) {
    if (findKnownAi(body, index)) {
      return index;
    }
  }

  return limit;
}

function applyAi(ai: string, value: string, result: ParsedGs1Code): void {
  switch (ai) {
    case '01':
      if (/^\d{14}$/.test(value)) {
        result.gtin = value;
      } else {
        result.errors.push(`AI 01 ожидает 14 цифр, получено: ${value || 'пусто'}.`);
      }
      break;
    case '10':
      result.batch = value.slice(0, VARIABLE_AI_MAX_LENGTHS['10']);
      break;
    case '11':
      applyDateAi('11', value, result, 'productionDate');
      break;
    case '15':
      applyDateAi('15', value, result, 'bestBeforeDate');
      break;
    case '17':
      applyDateAi('17', value, result, 'expiryDate');
      break;
    case '21':
      result.serial = value.slice(0, VARIABLE_AI_MAX_LENGTHS['21']);
      break;
    case '7003': {
      const dateTime = parseGs1DateTimeYYMMDDhhmm(value);
      if (dateTime) {
        result.expiryDateTime = dateTime;
      } else {
        result.errors.push(`AI 7003 содержит невалидную дату и время: ${value || 'пусто'}.`);
      }
      break;
    }
    default:
      result.unknownAis.push({ ai, value });
  }
}

function applyDateAi(
  ai: '11' | '15' | '17',
  value: string,
  result: ParsedGs1Code,
  field: 'productionDate' | 'bestBeforeDate' | 'expiryDate'
): void {
  const date = parseGs1DateYYMMDD(value);
  if (date) {
    result[field] = date;
  } else {
    result.errors.push(`AI ${ai} содержит невалидную дату: ${value || 'пусто'}.`);
  }
}

function getConfidence(result: ParsedGs1Code): Gs1Confidence {
  const hasCoreIdentity = Boolean(result.gtin && (result.serial || result.batch || result.expiryDate || result.expiryDateTime));
  if (hasCoreIdentity && result.errors.length === 0) {
    return 'high';
  }

  if (result.gtin || result.expiryDate || result.expiryDateTime || result.bestBeforeDate) {
    return 'medium';
  }

  return 'low';
}
