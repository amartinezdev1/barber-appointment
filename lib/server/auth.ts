import {getChatGPTUser} from '../../app/chatgpt-auth';
import type {Actor,Membership,Profile,Tenant} from '../types';
import {canAccessBranch} from '../scheduling';
import {database,id,one,rows,statement} from './db';
import {assert} from './http';
export async function actor():Promise<Actor>{
 const user=await getChatGPTUser();assert(user,401,'Inicia sesión para continuar.');
 const ready=await one<{value:string}>('SELECT value FROM app_state WHERE key=?','ready');assert(ready,428,'Inicializa tu espacio de trabajo.');
 await database().batch([statement('INSERT INTO profiles (id,email,name,is_platform_admin) VALUES (?,?,?,0) ON CONFLICT(id) DO UPDATE SET email=excluded.email,name=excluded.name',user.userId,user.email.toLowerCase(),user.displayName)]);
 const grants=await rows<{tenant_id:string;role:string;branch_ids:string;barber_id:string|null}>('SELECT * FROM access_grants WHERE email=?',user.email.toLowerCase());
 if(grants.length)await database().batch(grants.map(g=>statement('INSERT INTO memberships (id,tenant_id,user_id,role,branch_ids,barber_id) VALUES (?,?,?,?,?,?) ON CONFLICT(tenant_id,user_id) DO UPDATE SET role=excluded.role,branch_ids=excluded.branch_ids,barber_id=excluded.barber_id',id(),g.tenant_id,user.userId,g.role,g.branch_ids,g.barber_id)));
 const profile=await one<Profile>('SELECT * FROM profiles WHERE id=?',user.userId);assert(profile,403,'No tienes acceso.');
 return {profile,memberships:await rows<Membership>('SELECT * FROM memberships WHERE user_id=?',user.userId)};
}
export async function tenantContext(tenantId:string){const user=await actor();const membership=user.memberships.find(m=>m.tenant_id===tenantId)||null;assert(user.profile.is_platform_admin||membership,403,'No tienes acceso a esta empresa.');const tenant=await one<Tenant>('SELECT * FROM tenants WHERE id=?',tenantId);assert(tenant,404,'No se encontró la empresa.');return{user,membership,tenant};}
export function requireOwner(ctx:Awaited<ReturnType<typeof tenantContext>>){assert(ctx.user.profile.is_platform_admin||ctx.membership?.role==='owner',403,'Esta operación requiere permisos de propietario.');}
export function requireBranch(ctx:Awaited<ReturnType<typeof tenantContext>>,branchId:string,barberId?:string){assert(canAccessBranch(ctx.membership,!!ctx.user.profile.is_platform_admin,branchId,barberId),403,'No tienes permisos para esta sucursal o barbero.');}
export function requireManager(ctx:Awaited<ReturnType<typeof tenantContext>>){assert(ctx.user.profile.is_platform_admin||['owner','manager'].includes(ctx.membership?.role||''),403,'Esta operación requiere permisos de administración.');}
