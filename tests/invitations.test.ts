import {test} from 'node:test';
import assert from 'node:assert/strict';
import {invitationRedirect,sendAccessInvitation,type InvitationMailer} from '../lib/invitations.ts';

test('la invitación regresa a la aplicación configurada y conserva la seguridad del origen',()=>{
 assert.equal(invitationRedirect('https://barber.example.com/path?x=y'), 'https://barber.example.com/auth/accept');
 assert.equal(invitationRedirect('http://127.0.0.1:5173'), 'http://127.0.0.1:5173/auth/accept');
 for(const value of ['javascript:alert(1)','http://barber.example.com','https://user:password@barber.example.com'])assert.throws(()=>invitationRedirect(value));
});
test('una cuenta nueva recibe una invitación con la redirección esperada',async()=>{
 const calls:unknown[]=[];
 const mailer:InvitationMailer={auth:{admin:{inviteUserByEmail:async(email,options)=>{calls.push({email,...options});return{error:null};}},resetPasswordForEmail:async()=>{throw new Error('No debe enviar recuperación.');}}};
 const result=await sendAccessInvitation(mailer,'worker@example.invalid','https://barber.example.com/auth/accept');
 assert.equal(result.sent,true);assert.equal(result.kind,'invite');assert.deepEqual(calls,[{email:'worker@example.invalid',redirectTo:'https://barber.example.com/auth/accept'}]);
});
test('una cuenta existente recibe un enlace de recuperación, sin crear otra cuenta',async()=>{
 let recovery=0;
 const mailer:InvitationMailer={auth:{admin:{inviteUserByEmail:async()=>({error:{code:'email_exists',message:'User already registered'}})},resetPasswordForEmail:async(email,options)=>{recovery++;assert.equal(email,'worker@example.invalid');assert.equal(options.redirectTo,'https://barber.example.com/auth/accept');return{error:null};}}};
 const result=await sendAccessInvitation(mailer,'worker@example.invalid','https://barber.example.com/auth/accept');assert.equal(result.sent,true);assert.equal(result.kind,'recovery');assert.equal(recovery,1);
});
test('un fallo de SMTP no se presenta como una invitación enviada',async()=>{
 const mailer:InvitationMailer={auth:{admin:{inviteUserByEmail:async()=>({error:{code:'email_address_not_authorized',message:'Email address not authorized'}})},resetPasswordForEmail:async()=>{throw new Error('No debe reenviar cuando falla SMTP.');}}};
 const result=await sendAccessInvitation(mailer,'worker@example.invalid','https://barber.example.com/auth/accept');assert.equal(result.sent,false);assert.match(result.message,/SMTP/);
});
test('se distingue la limitación de envíos y el fallo de recuperación',async()=>{
 for(const existing of [false,true]){
  const mailer:InvitationMailer={auth:{admin:{inviteUserByEmail:async()=>({error:existing?{code:'email_exists',message:'Already exists'}:{status:429,message:'Rate limit'}})},resetPasswordForEmail:async()=>({error:{status:429,message:'Rate limit'}})}};
  const result=await sendAccessInvitation(mailer,'worker@example.invalid','https://barber.example.com/auth/accept');assert.equal(result.sent,false);assert.match(result.message,/limitó/);
 }
});
