import assert from 'node:assert/strict';
import { test } from 'node:test';
import { interleaveWisdom } from '../src/wisdom.ts';

test('Wisdom only adds supplied thoughts without replacing customer cards', () => {
  const cards = Array.from({ length: 17 }, (_, id) => ({ id }));
  const thoughts = [{ id: 'first', text: 'First' }, { id: 'second', text: 'Second' }];

  const disabled = interleaveWisdom(cards, thoughts, false);
  const enabled = interleaveWisdom(cards, thoughts, true);
  const withoutSource = interleaveWisdom(cards, [], true);

  assert.deepEqual(disabled.map(item => item.kind), Array(17).fill('card'));
  assert.deepEqual(withoutSource.map(item => item.kind), Array(17).fill('card'));
  assert.deepEqual(enabled.flatMap(item => item.kind === 'thought' ? item.thought.id : []), ['first', 'second']);
  assert.deepEqual(enabled.flatMap(item => item.kind === 'card' ? item.card.id : []), cards.map(card => card.id));
  assert.equal(enabled[8].kind, 'thought');
  assert.equal(enabled[17].kind, 'thought');
});
