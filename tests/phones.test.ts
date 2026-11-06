import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePhone} from '../lib/phones.ts';
import {bookingInput,phone} from '../lib/validation.ts';

for(const input of ['6123-4567','6123 4567','61234567','  (6123) 4567  ']){
 test('Panama local number: '+input,()=>{
  assert.equal(normalizePhone(input),'+50761234567');
  assert.equal(phone.parse(input),'+50761234567');
 });
}

test('International prefixes remain unchanged without duplicating +507',()=>{
 for(const [input,expected] of [['+507 6123-4567','+50761234567'],['+1 (202) 555-0123','+12025550123'],['+34 612 345 678','+34612345678']]){
  assert.equal(phone.parse(input),expected);
  assert.equal(normalizePhone(expected),expected);
 }
});

test('Invalid numbers are rejected instead of guessing their prefix',()=>{
 for(const input of ['', '1234567','612345678','6123abcd','+507+61234567','+012345678','+1234567890123456']){
  assert.equal(phone.safeParse(input).success,false,input);
 }
});

test('Reservation input normalizes a local number even when client formatting is bypassed',()=>{
 const booking=bookingInput.parse({slug:'barberia',branch_id:'sede',service_id:'corte',start_at:Date.now(),client_name:'Cliente',client_phone:'6123-4567'});
 assert.equal(booking.client_phone,'+50761234567');
});
