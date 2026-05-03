import { describe, expect, it } from 'vitest';
import {
  normalizeGs1Raw,
  parseGs1Code,
  parseGs1DateTimeYYMMDDhhmm,
  parseGs1DateYYMMDD,
} from './gs1Parser';

const GS = String.fromCharCode(29);
const REAL_MARK_CODE = '<GS>0104601241027663215GWEGZtHjJ7HJ<GS>93LD0C';

describe('GS1 parser', () => {
  it('parses bracketed GTIN, expiry date and serial', () => {
    const parsed = parseGs1Code('(01)04601234567890(17)260501(21)ABC123');

    expect(parsed.gtin).toBe('04601234567890');
    expect(parsed.expiryDate).toBe('2026-05-01');
    expect(parsed.serial).toBe('ABC123');
    expect(parsed.confidence).toBe('high');
  });

  it('parses plain GTIN, expiry date and serial without separators', () => {
    const parsed = parseGs1Code('01046012345678901726050121ABC123');

    expect(parsed.gtin).toBe('04601234567890');
    expect(parsed.expiryDate).toBe('2026-05-01');
    expect(parsed.serial).toBe('ABC123');
  });

  it('parses plain string with group separator before serial', () => {
    const parsed = parseGs1Code(`010460123456789017260501${GS}21ABC123`);

    expect(parsed.gtin).toBe('04601234567890');
    expect(parsed.expiryDate).toBe('2026-05-01');
    expect(parsed.serial).toBe('ABC123');
  });

  it('parses batch and serial separated by group separator', () => {
    const parsed = parseGs1Code(`010460123456789010LOT-42${GS}21SERIAL-7`);

    expect(parsed.batch).toBe('LOT-42');
    expect(parsed.serial).toBe('SERIAL-7');
  });

  it('parses production date AI 11', () => {
    const parsed = parseGs1Code('(01)04601234567890(11)260101');

    expect(parsed.productionDate).toBe('2026-01-01');
  });

  it('parses best before date AI 15', () => {
    const parsed = parseGs1Code('(01)04601234567890(15)260228');

    expect(parsed.bestBeforeDate).toBe('2026-02-28');
  });

  it('parses expiry date time AI 7003', () => {
    const parsed = parseGs1Code('(01)04601234567890(7003)2605011530');

    expect(parsed.expiryDateTime).toBe('2026-05-01T15:30');
  });

  it('reports invalid dates', () => {
    const parsed = parseGs1Code('(01)04601234567890(17)261399');

    expect(parsed.expiryDate).toBeUndefined();
    expect(parsed.errors[0]).toContain('AI 17');
  });

  it('keeps unknown AIs', () => {
    const parsed = parseGs1Code('(01)04601234567890(99)HELLO');

    expect(parsed.unknownAis).toEqual([{ ai: '99', value: 'HELLO' }]);
  });

  it('reports empty strings', () => {
    const parsed = parseGs1Code('   ');

    expect(parsed.confidence).toBe('low');
    expect(parsed.errors).toHaveLength(1);
  });

  it('removes ]d2 symbology identifier', () => {
    const parsed = parseGs1Code(']d2010460123456789017260501');

    expect(parsed.symbologyIdentifier).toBe(']d2');
    expect(parsed.gtin).toBe('04601234567890');
    expect(parsed.expiryDate).toBe('2026-05-01');
  });

  it('normalizes escaped group separator text', () => {
    expect(normalizeGs1Raw('01ABC\\u001D21XYZ')).toBe(`01ABC${GS}21XYZ`);
  });

  it('normalizes visible group separator placeholders', () => {
    expect(normalizeGs1Raw('01ABC<GS>21XYZ')).toBe(`01ABC${GS}21XYZ`);
    expect(normalizeGs1Raw('01ABC&lt;GS&gt;21XYZ')).toBe(`01ABC${GS}21XYZ`);
  });

  it('parses real-world Chestny Znak code with visible <GS> separators and service AI 93', () => {
    const parsed = parseGs1Code(REAL_MARK_CODE);

    expect(parsed.gtin).toBe('04601241027663');
    expect(parsed.serial).toBe('5GWEGZtHjJ7HJ');
    expect(parsed.serviceAis).toEqual([{ ai: '93', value: 'LD0C' }]);
    expect(parsed.expiryDate).toBeUndefined();
    expect(parsed.bestBeforeDate).toBeUndefined();
    expect(parsed.expiryDateTime).toBeUndefined();
    expect(parsed.errors).toHaveLength(0);
    expect(parsed.confidence).toBe('medium');
  });

  it('parses the same real-world code with ASCII group separators', () => {
    const parsed = parseGs1Code(`${GS}0104601241027663215GWEGZtHjJ7HJ${GS}93LD0C`);

    expect(parsed.gtin).toBe('04601241027663');
    expect(parsed.serial).toBe('5GWEGZtHjJ7HJ');
    expect(parsed.serviceAis).toContainEqual({ ai: '93', value: 'LD0C' });
    expect(parsed.errors).toHaveLength(0);
  });

  it('parses the same real-world code with escaped \\u001D separators', () => {
    const parsed = parseGs1Code('\\u001D0104601241027663215GWEGZtHjJ7HJ\\u001D93LD0C');

    expect(parsed.gtin).toBe('04601241027663');
    expect(parsed.serial).toBe('5GWEGZtHjJ7HJ');
    expect(parsed.serviceAis).toContainEqual({ ai: '93', value: 'LD0C' });
    expect(parsed.errors).toHaveLength(0);
  });

  it('parses the same real-world code with HTML-escaped group separators', () => {
    const parsed = parseGs1Code('&lt;GS&gt;0104601241027663215GWEGZtHjJ7HJ&lt;GS&gt;93LD0C');

    expect(parsed.gtin).toBe('04601241027663');
    expect(parsed.serial).toBe('5GWEGZtHjJ7HJ');
    expect(parsed.serviceAis).toContainEqual({ ai: '93', value: 'LD0C' });
    expect(parsed.errors).toHaveLength(0);
  });

  it('does not treat missing expiry date as a parsing error', () => {
    const parsed = parseGs1Code(REAL_MARK_CODE);

    expect(parsed.expiryDate).toBeUndefined();
    expect(parsed.errors).not.toEqual(expect.arrayContaining([expect.stringContaining('17')]));
    expect(parsed.errors).toHaveLength(0);
  });

  it('keeps AI 93 in service fields without an error', () => {
    const parsed = parseGs1Code(`${GS}0104601241027663215GWEGZtHjJ7HJ${GS}93LD0C`);

    expect(parsed.serviceAis).toEqual([{ ai: '93', value: 'LD0C' }]);
    expect(parsed.unknownAis).toHaveLength(0);
    expect(parsed.errors).toHaveLength(0);
  });
});

describe('GS1 date helpers', () => {
  it('uses 20YY below 50 and 19YY otherwise', () => {
    expect(parseGs1DateYYMMDD('490101')).toBe('2049-01-01');
    expect(parseGs1DateYYMMDD('500101')).toBe('1950-01-01');
  });

  it('rejects invalid values', () => {
    expect(parseGs1DateYYMMDD('260230')).toBeNull();
    expect(parseGs1DateTimeYYMMDDhhmm('2601012460')).toBeNull();
  });
});
