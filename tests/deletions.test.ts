import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {PGlite} from '@electric-sql/pglite';
import {btree_gist} from '@electric-sql/pglite/contrib/btree_gist';
import {deleteRecord,DeletionError} from '../lib/server/deletions.ts';
import {toPostgres} from '../lib/server/postgres-sql.ts';
import type {Actor,Membership,Tenant} from '../lib/types';
import type {Database,PreparedStatement,QueryResult} from '../lib/server/database-contract';

type Fixture={db:Database;exec:(sql:string)=>Promise<void>;get:(sql:string,...values:unknown[])=>Promise<Record<string,unknown>|null>;close:()=>Promise<void>;beforeBatch?:()=>Promise<void>};
async function fixture(backend:'sqlite'|'postgres'):Promise<Fixture>{
 const sqlite=backend==='sqlite'?new DatabaseSync(':memory:'):null;
 const postgres=backend==='postgres'?new PGlite({extensions:{btree_gist}}):null;
 async function exec(sql:string){if(sqlite)sqlite.exec(sql);else await postgres!.exec(toPostgres(sql));}
 if(sqlite)sqlite.exec('PRAGMA foreign_keys=ON;'+readFileSync(new URL('../drizzle/0000_quick_zombie.sql',import.meta.url),'utf8'));else await postgres!.exec(readFileSync(new URL('../supabase/migrations/202611050001_ritual.sql',import.meta.url),'utf8'));
 async function query(sql:string,values:unknown[]):Promise<QueryResult>{
  if(sqlite){const statement=sqlite.prepare(sql);if(statement.columns().length)return{results:statement.all(...values as never[]) as Record<string,unknown>[],meta:{changes:0}};return{results:[],meta:{changes:Number(statement.run(...values as never[]).changes)}};}
  const result=await postgres!.query(toPostgres(sql),values);return{results:result.rows as Record<string,unknown>[],meta:{changes:result.affectedRows??0}};
 }
 function prepare(sql:string,values:unknown[]=[]):PreparedStatement{return{bind(...params){return prepare(sql,params);},async all<T>(){return await query(sql,values) as QueryResult<T>;},async first<T>(){return(await query(sql,values)).results[0] as T||null;},async run(){return query(sql,values);}};}
 const f:Fixture={db:{prepare,async batch(statements){await f.beforeBatch?.();await exec('BEGIN');try{const result=[];for(const statement of statements)result.push(await statement.run());await exec('COMMIT');return result;}catch(error){await exec('ROLLBACK');throw error;}}},exec,get:async(sql,...values)=>(await query(sql,values)).results[0]||null,close:async()=>{if(sqlite)sqlite.close();else await postgres!.close();}};
 await exec(`
  INSERT INTO profiles(id,email,name,is_platform_admin) VALUES ('operator','operator@example.invalid','Operador',1),('owner','owner@example.invalid','Dueño',0),('worker','worker@example.invalid','Equipo',0);
  INSERT INTO app_state(key,value) VALUES ('ready','1');
  INSERT INTO tenants(id,name,slug) VALUES ('t1','Barbería A','barberia-a'),('t2','Barbería B','barberia-b');
  INSERT INTO branches(id,tenant_id,name) VALUES ('a','t1','Principal'),('b','t1','Segunda'),('other','t2','Otra');
  INSERT INTO barbers(id,tenant_id,name,initials) VALUES ('c','t1','Carlos','C'),('l','t1','Luis','L'),('other','t2','Otro','O');
  INSERT INTO services(id,tenant_id,name,minutes,price_cents) VALUES ('cut','t1','Corte',30,1500),('other','t2','Otro',30,1500);
  INSERT INTO branch_services(tenant_id,branch_id,service_id) VALUES ('t1','a','cut'),('t1','b','cut'),('t2','other','other');
  INSERT INTO barber_services(tenant_id,barber_id,service_id) VALUES ('t1','c','cut'),('t1','l','cut'),('t2','other','other');
  INSERT INTO memberships(id,tenant_id,user_id,role,branch_ids) VALUES ('owner','t1','owner','owner','[]');
  INSERT INTO shifts(id,tenant_id,barber_id,branch_id,date,start_at,end_at) VALUES ('shift','t1','c','a','2026-11-05',0,28800000);
 `);
 return f;
}
async function context(f:Fixture,role:'operator'|'owner'|'manager'|'barber'='operator'){
 const profile={id:role==='operator'?'operator':role==='owner'?'owner':'worker',email:role+'@example.invalid',name:role,is_platform_admin:role==='operator'?1:0};
 const membership:Membership|null=role==='operator'?null:{id:role,tenant_id:'t1',user_id:profile.id,role:role==='owner'?'owner':role,branch_ids:JSON.stringify(['a']),barber_id:role==='barber'?'c':null};
 return{tenant:await f.get("SELECT * FROM tenants WHERE id='t1'") as Tenant,user:{profile,memberships:membership?[membership]:[]} as Actor,membership};
}
async function book(f:Fixture){await f.exec(`INSERT INTO bookings(id,tenant_id,barber_id,branch_id,service_id,start_at,end_at,busy_until,client_name,client_phone,price_cents,minutes,service_name,reference,manage_hash,created_at) VALUES ('booking','t1','c','a','cut',0,1800000,2100000,'Cliente','+50760000000',1500,30,'Corte','RIT-TEST','hash',0); INSERT INTO notifications(id,tenant_id,booking_id,kind,due_at,created_at) VALUES ('notice','t1','booking','reminder',0,0);`);}
const rejects=(operation:Promise<unknown>,status:number)=>assert.rejects(operation,error=>error instanceof DeletionError&&error.status===status);
for(const backend of ['sqlite','postgres'] as const){
 test(`eliminaciones en ${backend}`,async t=>{
  async function check(name:string,run:(f:Fixture)=>Promise<void>){await t.test(name,async()=>{const f=await fixture(backend);try{await run(f);}finally{await f.close();}});}
  await check('servicio sin reservas: elimina asignaciones, conserva otra empresa y deja auditoría',async f=>{
   await deleteRecord(f.db,await context(f),{action:'deleteService',id:'cut'});
   assert.equal(await f.get("SELECT id FROM services WHERE id='cut'"),null);assert.equal(await f.get("SELECT tenant_id FROM branch_services WHERE tenant_id='t1'"),null);assert.equal(await f.get("SELECT tenant_id FROM barber_services WHERE tenant_id='t1'"),null);
   assert.ok(await f.get("SELECT id FROM services WHERE id='other'"));assert.ok(await f.get("SELECT id FROM audit WHERE action='service.deleted'"));
  });
  await check('sucursal sin dependencias: limpia ofertas y conserva la sede principal',async f=>{
   await deleteRecord(f.db,await context(f),{action:'deleteBranch',id:'b'});assert.equal(await f.get("SELECT id FROM branches WHERE id='b'"),null);assert.ok(await f.get("SELECT id FROM branches WHERE id='a'"));
   await rejects(deleteRecord(f.db,await context(f),{action:'deleteBranch',id:'a'}),409);
  });
  await check('sucursal con turnos o accesos: se rechaza sin ampliar permisos',async f=>{
   await rejects(deleteRecord(f.db,await context(f),{action:'deleteBranch',id:'a'}),409);
   await f.exec(`INSERT INTO access_grants(id,tenant_id,email,role,branch_ids) VALUES ('grant','t1','manager@example.invalid','manager','["b"]')`);
   await rejects(deleteRecord(f.db,await context(f),{action:'deleteBranch',id:'b'}),409);
   assert.equal((await f.get("SELECT branch_ids FROM access_grants WHERE id='grant'"))?.branch_ids,'["b"]');
  });
  await check('no elimina la última sucursal activa aunque haya otra archivada',async f=>{
   await f.exec("UPDATE branches SET active=0 WHERE id='b'");await rejects(deleteRecord(f.db,await context(f),{action:'deleteBranch',id:'a'}),409);
  });
  await check('dos eliminaciones de sucursal no pueden dejar el negocio sin sede',async f=>{
   f.beforeBatch=async()=>{f.beforeBatch=undefined;await f.exec("DELETE FROM branch_services WHERE branch_id='a'; DELETE FROM shifts WHERE id='shift'; DELETE FROM branches WHERE id='a'");};
   await rejects(deleteRecord(f.db,await context(f),{action:'deleteBranch',id:'b'}),409);assert.ok(await f.get("SELECT id FROM branches WHERE id='b'"));assert.ok(await f.get("SELECT service_id FROM branch_services WHERE branch_id='b'"));assert.equal(await f.get("SELECT id FROM audit WHERE action='branch.deleted'"),null);
  });
  await check('barbero sin actividad se elimina; turnos y accesos vinculados lo protegen',async f=>{
   await deleteRecord(f.db,await context(f),{action:'deleteBarber',id:'l'});assert.equal(await f.get("SELECT id FROM barbers WHERE id='l'"),null);
   await rejects(deleteRecord(f.db,await context(f),{action:'deleteBarber',id:'c'}),409);
   await f.exec(`DELETE FROM shifts WHERE id='shift'; INSERT INTO access_grants(id,tenant_id,email,role,barber_id) VALUES ('grant','t1','worker@example.invalid','barber','c')`);
   await rejects(deleteRecord(f.db,await context(f),{action:'deleteBarber',id:'c'}),409);
  });
  await check('reservas existentes protegen el catálogo',async f=>{
   await book(f);for(const [action,id] of [['deleteService','cut'],['deleteBarber','c'],['deleteBranch','a']])await rejects(deleteRecord(f.db,await context(f),{action,id}),409);
   assert.ok(await f.get("SELECT id FROM bookings WHERE id='booking'"));
  });
  await check('la reserva se elimina con sus avisos y libera su turno',async f=>{
   await book(f);await deleteRecord(f.db,await context(f,'manager'),{action:'deleteBooking',id:'booking',version:1});assert.equal(await f.get("SELECT id FROM bookings WHERE id='booking'"),null);assert.equal(await f.get("SELECT id FROM notifications WHERE id='notice'"),null);
   await deleteRecord(f.db,await context(f,'manager'),{action:'deleteShift',id:'shift'});assert.equal(await f.get("SELECT id FROM shifts WHERE id='shift'"),null);assert.ok(await f.get("SELECT id FROM audit WHERE action='booking.deleted'"));
  });
  await check('una reserva que cambia durante la confirmación conserva sus avisos',async f=>{
   await book(f);f.beforeBatch=async()=>{f.beforeBatch=undefined;await f.exec("UPDATE bookings SET version=version+1 WHERE id='booking'");};
   await rejects(deleteRecord(f.db,await context(f),{action:'deleteBooking',id:'booking',version:1}),409);assert.ok(await f.get("SELECT id FROM notifications WHERE id='notice'"));assert.equal(Number((await f.get("SELECT version FROM bookings WHERE id='booking'"))?.version),2);assert.equal(await f.get("SELECT id FROM audit WHERE action='booking.deleted'"),null);
  });
  await check('el turno con reserva vigente rechaza la eliminación y revierte la auditoría',async f=>{
   await book(f);await assert.rejects(deleteRecord(f.db,await context(f),{action:'deleteShift',id:'shift'}),/SHIFT_HAS_BOOKINGS/);assert.ok(await f.get("SELECT id FROM shifts WHERE id='shift'"));assert.equal(await f.get("SELECT id FROM audit WHERE action='shift.deleted'"),null);
  });
  await check('una reserva creada durante la eliminación revierte todo el cambio de catálogo',async f=>{
   f.beforeBatch=async()=>{f.beforeBatch=undefined;await book(f);};await rejects(deleteRecord(f.db,await context(f),{action:'deleteService',id:'cut'}),409);assert.ok(await f.get("SELECT id FROM services WHERE id='cut'"));assert.ok(await f.get("SELECT service_id FROM branch_services WHERE service_id='cut'"));assert.ok(await f.get("SELECT service_id FROM barber_services WHERE service_id='cut'"));assert.equal(await f.get("SELECT id FROM audit WHERE action='service.deleted'"),null);
  });
  await check('permisos por rol y sucursal, y aislamiento entre empresas',async f=>{
   const owner=await context(f,'owner'),manager=await context(f,'manager'),barber=await context(f,'barber');
   await rejects(deleteRecord(f.db,manager,{action:'deleteService',id:'cut'}),403);await rejects(deleteRecord(f.db,barber,{action:'deleteShift',id:'shift'}),403);
   await rejects(deleteRecord(f.db,owner,{action:'deleteService',id:'other'}),404);await rejects(deleteRecord(f.db,owner,{action:'deleteTenant',confirmation:'Barbería A'}),403);
   await f.exec("INSERT INTO shifts(id,tenant_id,branch_id,barber_id,date,start_at,end_at) VALUES ('restricted','t1','b','l','2026-11-06',40000000,50000000)");await rejects(deleteRecord(f.db,manager,{action:'deleteShift',id:'restricted'}),403);
   assert.ok(await f.get("SELECT id FROM services WHERE id='other'"));
  });
  await check('el aviso puede eliminarse sin borrar la reserva',async f=>{
   await book(f);await rejects(deleteRecord(f.db,await context(f,'manager'),{action:'deleteNotification',id:'notice'}),403);await deleteRecord(f.db,await context(f,'owner'),{action:'deleteNotification',id:'notice'});assert.equal(await f.get("SELECT id FROM notifications WHERE id='notice'"),null);assert.ok(await f.get("SELECT id FROM bookings WHERE id='booking'"));
  });
  await check('barbería completa: confirmación exacta, sin afectar otras empresas ni cuentas',async f=>{
   await book(f);await f.exec("INSERT INTO audit(id,tenant_id,actor_id,action,entity_id,created_at) VALUES ('past','t1','operator','booking.created','booking',0)");
   await rejects(deleteRecord(f.db,await context(f),{action:'deleteTenant',confirmation:'incorrecta'}),400);
   await deleteRecord(f.db,await context(f),{action:'deleteTenant',confirmation:'Barbería A'});
   for(const table of ['tenants','branches','barbers','services','bookings','shifts','notifications','access_grants','memberships','branch_services','barber_services'])assert.equal(await f.get(`SELECT ${table==='tenants'?'id':'tenant_id'} FROM ${table} WHERE ${table==='tenants'?'id':'tenant_id'}='t1'`),null,table);
   assert.ok(await f.get("SELECT id FROM tenants WHERE id='t2'"));assert.ok(await f.get("SELECT id FROM branches WHERE id='other'"));assert.ok(await f.get("SELECT id FROM profiles WHERE id='owner'"));assert.ok(await f.get("SELECT key FROM app_state WHERE key='ready'"));assert.equal((await f.get("SELECT tenant_id FROM audit WHERE id='past'"))?.tenant_id,null);assert.ok(await f.get("SELECT id FROM audit WHERE action='tenant.deleted'"));
   const ctx=await context(f);ctx.tenant=await f.get("SELECT * FROM tenants WHERE id='t2'") as Tenant;await deleteRecord(f.db,ctx,{action:'deleteTenant',confirmation:'Barbería B'});assert.equal(await f.get('SELECT id FROM tenants'),null);assert.ok(await f.get("SELECT id FROM profiles WHERE id='operator'"));
  });
 });
}
