/* Regression tests for the accuracy-critical pure logic.
 *   node --test
 * These guard the deterministic validated-match path, pronoun substitution,
 * language detection, sanitation, and the closest-validated fallback so they
 * cannot silently break as Marie edits translations.html / reference terms.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalize,
  detectDirection,
  applyPronoun,
  hasBan,
  sanitize,
  buildValidatedIndex,
  lookupValidated,
  closestValidated,
} from '../lib/text-utils.js';
import GLOSSARY from '../lib/glossary.js';

test('normalize: accent/case/punct insensitive', () => {
  assert.equal(normalize('  Chào BẠN!! '), 'chao ban');
  assert.equal(normalize('Không có gì.'), 'khong co gi');
  assert.equal(normalize('Đo nhĩ lượng'), 'do nhi luong');
});

test('detectDirection', () => {
  assert.equal(detectDirection('Do you have ringing in your ears?'), 'en2vi');
  assert.equal(detectDirection('Bạn có bị ù tai không?'), 'vi2en');
  assert.equal(detectDirection(''), 'en2vi');
});

test('applyPronoun: capitalization + word safety', () => {
  assert.equal(applyPronoun('Bạn có bị ù tai không? Cảm ơn bạn.', 'ông', 'Ông'),
    'Ông có bị ù tai không? Cảm ơn ông.');
  assert.equal(applyPronoun('Chào bạn.', 'chị', 'Chị'), 'Chào chị.');
  assert.equal(applyPronoun('Chào bạn.', 'bạn', 'Bạn'), 'Chào bạn.'); // default unchanged
  assert.equal(applyPronoun('xin chàobạnnhé', 'ông', 'Ông'), 'xin chàobạnnhé'); // no inner match
});

test('hasBan', () => {
  assert.equal(hasBan('Chào bạn.'), true);
  assert.equal(hasBan('Hello there.'), false);
});

test('sanitize: strips fences/labels/quotes', () => {
  assert.equal(sanitize('```\nXin chào\n```'), 'Xin chào');
  assert.equal(sanitize('Translation: Xin chào'), 'Xin chào');
  assert.equal(sanitize('"Xin chào"'), 'Xin chào');
  assert.equal(sanitize('Xin chào'), 'Xin chào');
});

test('validated lookup: exact, accent-insensitive, alternates, pronoun-excluded', () => {
  const idx = buildValidatedIndex(GLOSSARY);
  assert.equal(lookupValidated(idx, 'thank you', 'en2vi'), 'Cám ơn bạn.');
  assert.equal(lookupValidated(idx, 'HELLO', 'en2vi'), 'Chào bạn.');
  assert.equal(lookupValidated(idx, 'Khong co gi', 'vi2en'), "You're welcome."); // alternate
  assert.equal(lookupValidated(idx, 'I', 'en2vi'), null); // pronoun row excluded
  assert.equal(lookupValidated(idx, 'totally novel phrase', 'en2vi'), null);
});

test('closestValidated: returns a near phrase, null when far', () => {
  const near = closestValidated(GLOSSARY, 'Do you have any trouble with hearing', 'en2vi');
  assert.ok(near && near.phrase && near.translation, 'expected a suggestion');
  assert.equal(closestValidated(GLOSSARY, 'xyzzy qwerty foobar', 'en2vi'), null);
});
