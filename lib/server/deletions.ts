import {z} from 'zod';
import type {Actor,Membership,Tenant,Booking,Shift} from '../types';
import type {Database,PreparedStatement} from './database-contract';

type Context={tenant:Tenant;user:Actor;membership:Membership|null};
export class DeletionError extends Error {
 status:number;
 constructor(status:number,message:string){super(message);this.status=status;}
}
function ensure(value:unknown,status:number,message:string):asserts value {
 if(!value)throw new DeletionError(status,message);
}
export const deletionActions=new Set(['deleteTenant','deleteBranch','deleteBarber','deleteService','deleteBooking','deleteShift','deleteNotification']);

export async function deleteRecord(db:Database,ctx:Context,raw:unknown){
 const input=z.object({action:z.string(),id:z.string().min(1).max(100).optional(),version:z.number().int().min(1).optional(),confirmation:z.string().optional()}).parse(raw);
 const tenant=ctx.tenant.id,actor=ctx.user.profile.id,platform=!!ctx.user.profile.is_platform_admin;
 const owner=platform||ctx.membership?.role==='owner',manager=owner||ctx.membership?.role==='manager';
 const statement=(sql:string,...values:unknown[])=>db.prepare(sql).bind(...values);
 const one=<T=Record<string,unknown>>(sql:string,...values:unknown[])=>statement(sql,...values).first<T>();
 const rows=async<T=Record<string,unknown>>(sql:string,...values:unknown[])=>(await statement(sql,...values).all<T>()).results;
 const branchAccess=(id:string)=>ensure(owner||(ctx.membership?.role==='manager'&&(JSON.parse(ctx.membership.branch_ids) as string[]).includes(id)),403,'No tienes permisos para esta sucursal.');
 // Serialize removals within a tenant, including the last-active-branch check.
 const lock=statement('UPDATE tenants SET name=name WHERE id=?',tenant);
 const audit=(action:string,entity:string,table:string,predicate='id=?',values:unknown[]=[entity])=>statement(
  `INSERT INTO audit (id,tenant_id,actor_id,action,entity_id,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM ${table} WHERE tenant_id=? AND ${predicate})`,
  crypto.randomUUID(),tenant,actor,action,entity,Date.now(),tenant,...values);
 async function batch(statements:PreparedStatement[]){
  try{return await db.batch(statements);}catch(error){
   if((error as {code?:string})?.code==='23503'||/FOREIGN KEY constraint/i.test(error instanceof Error?error.message:''))throw new DeletionError(409,'El registro tiene datos relacionados. Elimínalos o archiva el registro antes de continuar.');
   throw error;
  }
 }
 if(input.action==='deleteTenant'){
  ensure(platform,403,'Solo el operador puede eliminar una barbería.');
  ensure(input.confirmation===ctx.tenant.name,400,'Escribe el nombre exacto de la barbería para eliminarla.');
  await batch([lock,
   statement('DELETE FROM notifications WHERE tenant_id=?',tenant),
   statement('DELETE FROM bookings WHERE tenant_id=?',tenant),
   statement('DELETE FROM shifts WHERE tenant_id=?',tenant),
   statement('DELETE FROM branch_services WHERE tenant_id=?',tenant),
   statement('DELETE FROM barber_services WHERE tenant_id=?',tenant),
   statement('DELETE FROM access_grants WHERE tenant_id=?',tenant),
   statement('DELETE FROM memberships WHERE tenant_id=?',tenant),
   statement('DELETE FROM barbers WHERE tenant_id=?',tenant),
   statement('DELETE FROM services WHERE tenant_id=?',tenant),
   statement('DELETE FROM branches WHERE tenant_id=?',tenant),
   statement('UPDATE audit SET tenant_id=NULL WHERE tenant_id=?',tenant),
   statement('INSERT INTO audit (id,tenant_id,actor_id,action,entity_id,created_at) VALUES (?,NULL,?,?,?,?)',crypto.randomUUID(),actor,'tenant.deleted',tenant,Date.now()),
   statement('DELETE FROM tenants WHERE id=?',tenant),
  ]);
  return{ok:true,deleted_tenant_id:tenant};
 }
 ensure(input.id,400,'Selecciona el registro que quieres eliminar.');const id=input.id;
 if(input.action==='deleteBooking'){
  ensure(manager,403,'La eliminación de reservas requiere un propietario o encargado.');
  const booking=await one<Booking>('SELECT * FROM bookings WHERE tenant_id=? AND id=?',tenant,id);
  ensure(booking,404,'Cita no encontrada.');branchAccess(booking.branch_id);
  ensure(input.version!==undefined,400,'Actualiza la reserva antes de eliminarla.');const version=input.version;
  // A no-op UPDATE locks the exact version without advancing it. Every following
  // write has the same version predicate, so a stale confirmation changes nothing.
  const result=await batch([lock,
   statement('UPDATE bookings SET version=version WHERE tenant_id=? AND id=? AND version=?',tenant,id,version),
   statement('DELETE FROM notifications WHERE tenant_id=? AND booking_id=? AND EXISTS (SELECT 1 FROM bookings WHERE tenant_id=? AND id=? AND version=?)',tenant,id,tenant,id,version),
   audit('booking.deleted',id,'bookings','id=? AND version=?',[id,version]),
   statement('DELETE FROM bookings WHERE tenant_id=? AND id=? AND version=?',tenant,id,version),
  ]);
  ensure(result[1].meta.changes===1,409,'La cita cambió en otra sesión. Actualiza los datos antes de eliminarla.');
  return{ok:true};
 }
 if(input.action==='deleteShift'){
  ensure(manager,403,'La eliminación de turnos requiere un propietario o encargado.');
  const shift=await one<Shift>('SELECT * FROM shifts WHERE tenant_id=? AND id=?',tenant,id);
  ensure(shift,404,'Turno no encontrado.');branchAccess(shift.branch_id);
  await batch([lock,audit('shift.deleted',id,'shifts'),statement('DELETE FROM shifts WHERE tenant_id=? AND id=?',tenant,id)]);
  return{ok:true};
 }
 ensure(owner,403,'Solo el propietario puede eliminar este registro.');
 if(input.action==='deleteNotification'){
  ensure(await one('SELECT id FROM notifications WHERE tenant_id=? AND id=?',tenant,id),404,'Aviso no encontrado.');
  await batch([lock,audit('notification.deleted',id,'notifications'),statement('DELETE FROM notifications WHERE tenant_id=? AND id=?',tenant,id)]);
  return{ok:true};
 }
 const targets={deleteBranch:{table:'branches',field:'branch_id',label:'La sucursal'},deleteBarber:{table:'barbers',field:'barber_id',label:'El barbero'},deleteService:{table:'services',field:'service_id',label:'El servicio'}} as const;
 ensure(input.action in targets,400,'Operación desconocida.');
 const target=targets[input.action as keyof typeof targets],{table,field,label}=target;
 ensure(await one(`SELECT id FROM ${table} WHERE tenant_id=? AND id=?`,tenant,id),404,`${label} no se encontró.`);
 ensure(!await one(`SELECT id FROM bookings WHERE tenant_id=? AND ${field}=? LIMIT 1`,tenant,id),409,`${label} tiene reservas asociadas. Puedes archivarlo desde Editar o eliminar primero esas reservas.`);
 const statements:PreparedStatement[]=[lock];
 if(input.action==='deleteBranch'){
  const branches=await rows<{id:string;active:number}>('SELECT id,active FROM branches WHERE tenant_id=?',tenant);
  ensure(branches.length>1,409,'La barbería debe conservar al menos una sucursal.');
  ensure(!branches.find(b=>b.id===id)?.active||branches.filter(b=>b.active).length>1,409,'La barbería debe conservar al menos una sucursal activa.');
  ensure(!await one('SELECT id FROM shifts WHERE tenant_id=? AND branch_id=? LIMIT 1',tenant,id),409,'La sucursal tiene turnos asignados. Elimina primero esos turnos.');
  const scopes=await rows<{branch_ids:string}>('SELECT branch_ids FROM access_grants WHERE tenant_id=? UNION ALL SELECT branch_ids FROM memberships WHERE tenant_id=?',tenant,tenant);
  ensure(!scopes.some(s=>(JSON.parse(s.branch_ids) as string[]).includes(id)),409,'La sucursal tiene accesos asignados. Actualiza o elimina esos accesos primero.');
  // Repeat the count guard inside the serialized transaction to protect against
  // two owners concurrently removing the two remaining active branches.
  const eligible='(SELECT count(*) FROM branches WHERE tenant_id=?)>1 AND (active=0 OR (SELECT count(*) FROM branches WHERE tenant_id=? AND active=1)>1)';
  const exists=`EXISTS (SELECT 1 FROM branches WHERE tenant_id=? AND id=? AND ${eligible})`;
  statements.push(statement(`DELETE FROM branch_services WHERE tenant_id=? AND branch_id=? AND ${exists}`,tenant,id,tenant,id,tenant,tenant));
  statements.push(audit('branch.deleted',id,table,`id=? AND ${eligible}`,[id,tenant,tenant]));
  statements.push(statement(`DELETE FROM branches WHERE tenant_id=? AND id=? AND ${eligible}`,tenant,id,tenant,tenant));
 }else if(input.action==='deleteBarber'){
  ensure(!await one('SELECT id FROM shifts WHERE tenant_id=? AND barber_id=? LIMIT 1',tenant,id),409,'El barbero tiene turnos asignados. Elimina primero esos turnos.');
  ensure(!await one('SELECT id FROM access_grants WHERE tenant_id=? AND barber_id=? UNION ALL SELECT id FROM memberships WHERE tenant_id=? AND barber_id=? LIMIT 1',tenant,id,tenant,id),409,'El barbero tiene accesos vinculados. Elimina primero esos accesos.');
  statements.push(statement('DELETE FROM barber_services WHERE tenant_id=? AND barber_id=?',tenant,id),audit('barber.deleted',id,table),statement('DELETE FROM barbers WHERE tenant_id=? AND id=?',tenant,id));
 }else{
  statements.push(statement('DELETE FROM branch_services WHERE tenant_id=? AND service_id=?',tenant,id),statement('DELETE FROM barber_services WHERE tenant_id=? AND service_id=?',tenant,id),audit('service.deleted',id,table),statement('DELETE FROM services WHERE tenant_id=? AND id=?',tenant,id));
 }
 const result=await batch(statements);
 ensure(result.at(-1)?.meta.changes===1,409,input.action==='deleteBranch'?'La barbería debe conservar una sucursal activa. Actualiza los datos.':'El registro ya fue eliminado. Actualiza los datos.');
 return{ok:true};
}
