import {z} from 'zod';
import {actor} from '../../../lib/server/auth';
import {adminData} from '../../../lib/server/repository';
import {command} from '../../../lib/server/commands';
import {body,errorResponse,json} from '../../../lib/server/http';
import {addDays,dateInZone} from '../../../lib/dates';
import {rows} from '../../../lib/server/db';
import {identifier,localDate} from '../../../lib/validation';
import type {Tenant} from '../../../lib/types';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{const query=new URL(request.url).searchParams;const user=await actor();const tenants=user.profile.is_platform_admin?await rows<Tenant>('SELECT * FROM tenants ORDER BY name'):await rows<Tenant>('SELECT t.* FROM tenants t JOIN memberships m ON m.tenant_id=t.id WHERE m.user_id=? ORDER BY t.name',user.profile.id);const tenantId=query.get('tenant')||tenants[0]?.id;if(!tenantId)return json({profile:user.profile,tenants:[],noAccess:true,canCreateTenant:!!user.profile.is_platform_admin});const today=dateInZone(Date.now(),'America/Panama'),from=localDate.parse(query.get('from')||today),to=localDate.parse(query.get('to')||addDays(from,30));z.string().refine(()=>to>=from&&Date.parse(to)-Date.parse(from)<=93*86400000,'El intervalo máximo es de 93 días.').parse(to);return json(await adminData(identifier.parse(tenantId),from,to));}catch(e){return errorResponse(e);}}
export async function POST(request:Request){try{return json(await command(await body(request)));}catch(e){return errorResponse(e);}}
