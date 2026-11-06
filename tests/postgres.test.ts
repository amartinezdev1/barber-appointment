import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {btree_gist} from '@electric-sql/pglite/contrib/btree_gist';
import {toPostgres} from '../lib/server/postgres-sql.ts';
test('el adaptador PostgreSQL conserva literales y parametriza valores',()=>{
 assert.equal(toPostgres("SELECT '?' AS value FROM bookings WHERE id=? AND status='bookings'"),"SELECT '?' AS value FROM ritual.bookings WHERE id=$1 AND status='bookings'");
 assert.equal(toPostgres('INSERT OR IGNORE INTO profiles (id,email,name) VALUES (?,?,?)'),'INSERT INTO ritual.profiles (id,email,name) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING');
 assert.equal(toPostgres('UPDATE rate_limits SET window=? WHERE key=?'),'UPDATE ritual.rate_limits SET "window"=$1 WHERE key=$2');
});
test('la migración PostgreSQL aplica las reglas de reservas y turnos',async t=>{
 const db=new PGlite({extensions:{btree_gist}});
 try{
  await db.exec(readFileSync(new URL('../supabase/migrations/202611050001_ritual.sql',import.meta.url),'utf8'));
  async function reset(){await db.exec("TRUNCATE ritual.tenants CASCADE; INSERT INTO ritual.tenants(id,name,slug) VALUES ('t1','A','a'),('t2','B','b'); INSERT INTO ritual.branches(id,tenant_id,name) VALUES ('a','t1','A'),('b','t1','B'),('other','t2','Other'); INSERT INTO ritual.barbers(id,tenant_id,name,initials) VALUES ('c','t1','Carlos','C'),('l','t1','Luis','L'); INSERT INTO ritual.services(id,tenant_id,name,minutes,price_cents) VALUES ('cut','t1','Corte',30,1500); INSERT INTO ritual.shifts(id,tenant_id,branch_id,barber_id,date,start_at,end_at,break_start,break_end) VALUES ('s1','t1','a','c','2026-11-05',0,28800000,10800000,14400000),('s2','t1','a','l','2026-11-05',0,28800000,NULL,NULL);");}
  async function book(id:string,start=0,end=1800000,barber='c'){await db.query(toPostgres("INSERT INTO bookings(id,tenant_id,barber_id,branch_id,service_id,start_at,end_at,busy_until,client_name,client_phone,price_cents,minutes,service_name,reference,manage_hash,created_at) VALUES (?,'t1',?,'a','cut',?,?,?,'Prueba','+50760000000',1500,30,'Corte',?,?,0)"),[id,barber,start,end,end+300000,id,id]);}
  await t.test('reserva superpuesta rechazada y otro barbero permitido',async()=>{await reset();await book('one');await assert.rejects(book('two',900000,2700000),/BOOKING_CONFLICT|bookings_no_overlap/);await book('other',0,1800000,'l');});
  await t.test('fuera de turno y durante descanso',async()=>{await reset();await assert.rejects(book('outside',28800000,30600000),/BOOKING_OUTSIDE_SHIFT/);await assert.rejects(book('rest',10800000,12600000),/BOOKING_OUTSIDE_SHIFT/);});
  await t.test('citas existentes protegen el turno y la cancelación lo libera',async()=>{await reset();await book('one');await assert.rejects(db.exec("UPDATE ritual.shifts SET branch_id='b' WHERE id='s1'"),/SHIFT_HAS_BOOKINGS/);await assert.rejects(db.exec("DELETE FROM ritual.shifts WHERE id='s1'"),/SHIFT_HAS_BOOKINGS/);await db.exec("UPDATE ritual.bookings SET status='cancelled' WHERE id='one';DELETE FROM ritual.shifts WHERE id='s1';");});
  await t.test('traslados y claves entre empresas',async()=>{await reset();await assert.rejects(db.exec("INSERT INTO ritual.shifts(id,tenant_id,branch_id,barber_id,date,start_at,end_at) VALUES ('bad','t1','b','c','2026-11-05',29000000,32000000)"),/SHIFT_CONFLICT/);await assert.rejects(db.exec("INSERT INTO ritual.shifts(id,tenant_id,branch_id,barber_id,date,start_at,end_at) VALUES ('cross','t1','other','c','2026-11-06',40000000,50000000)"),/foreign key/i);});
  await t.test('SQL de inicialización y limitador es compatible',async()=>{await db.query(toPostgres('INSERT OR IGNORE INTO app_state (key,value) VALUES (?,?)'),['test','ready']);await db.query(toPostgres('INSERT OR IGNORE INTO app_state (key,value) VALUES (?,?)'),['test','duplicate']);assert.equal((await db.query<{value:string}>(toPostgres('SELECT value FROM app_state WHERE key=?'),['test'])).rows[0].value,'ready');await db.query(toPostgres('INSERT INTO rate_limits (key,window,count) VALUES (?,?,1) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN rate_limits.window=excluded.window THEN rate_limits.count+1 ELSE 1 END,window=excluded.window RETURNING count'),['key',1]);});
 }finally{await db.close();}
});


test('la instalación mantiene las tablas privadas sin depender del search_path de ritual y con RLS automático',async()=>{
 const db=new PGlite({extensions:{btree_gist}});
 try{
  // Exercise the migration without its session SET, as well as a Supabase-style
  // DDL hook with a different search_path. The private schema must stay explicit.
  await db.exec(`
   CREATE FUNCTION public.test_auto_rls() RETURNS event_trigger
   LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
   DECLARE cmd record;
   BEGIN
    FOR cmd IN SELECT * FROM pg_event_trigger_ddl_commands()
     WHERE command_tag='CREATE TABLE' AND object_type='table'
    LOOP
     IF cmd.schema_name='public' THEN
      EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY',cmd.object_identity);
     END IF;
    END LOOP;
   END;
   $$;
   CREATE EVENT TRIGGER test_auto_rls ON ddl_command_end
    WHEN TAG IN ('CREATE TABLE') EXECUTE FUNCTION public.test_auto_rls();
   SET search_path=pg_catalog,public,extensions;
  `);
  const migration=readFileSync(new URL('../supabase/migrations/202611050001_ritual.sql',import.meta.url),'utf8');
  await db.exec(migration.replace(/^SET LOCAL search_path=.*;$/m,''));
  const tables=await db.query<{schema:string;name:string;rls:boolean}>(`
   SELECT n.nspname AS schema,c.relname AS name,c.relrowsecurity AS rls
   FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE c.relkind='r' AND n.nspname IN ('ritual','public') ORDER BY c.relname
  `);
  assert.equal(tables.rows.length,15);
  assert.ok(tables.rows.every(table=>table.schema==='ritual' && table.rls));
  assert.ok(tables.rows.some(table=>table.name==='app_state'));
  assert.equal((await db.query<{count:number}>('SELECT count(*)::int AS count FROM ritual.app_state')).rows[0].count,0);
  assert.equal((await db.query<{count:number}>('SELECT count(*)::int AS count FROM ritual.tenants')).rows[0].count,0);
 }finally{await db.close();}
});
