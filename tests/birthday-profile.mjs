import assert from 'node:assert/strict';
import {getRecipient, cakeGreeting, birthdayBlessing} from '../web/birthday-profile.js';

const recipient = getRecipient();
assert.deepEqual(recipient, { name: '悠悠', birthdayAge: 20, celebrationYear: 2026 });
assert.ok(Object.isFrozen(recipient));
assert.equal(cakeGreeting(recipient), '悠悠，20岁快乐');
const letter = birthdayBlessing(recipient);
assert.equal(letter.title, '悠悠，20岁生日快乐');
assert.ok(letter.paragraphs.some(line => line.includes('20岁')));
console.log('Fixed birthday dedication and candle greeting passed');
