import {test} from 'node:test';
import assert from 'node:assert/strict';
import {supabaseAdmin} from '../lib/server/supabase-admin.ts';
import {AppError} from '../lib/server/http.ts';

test('una publishable key no sustituye la clave de servidor para cargar portadas',()=>{
 const names=['SUPABASE_URL','SUPABASE_SECRET_KEY','SUPABASE_SERVICE_ROLE_KEY','SUPABASE_PUBLISHABLE_KEY'] as const;
 const previous=Object.fromEntries(names.map(name=>[name,process.env[name]]));
 try{
  process.env.SUPABASE_URL='https://example.supabase.co';
  process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_local_fixture';
  delete process.env.SUPABASE_SECRET_KEY;delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  assert.throws(()=>supabaseAdmin(),error=>error instanceof AppError&&error.status===503&&error.message.includes('SUPABASE_SECRET_KEY'));
 }finally{for(const name of names){if(previous[name]===undefined)delete process.env[name];else process.env[name]=previous[name];}}
});
