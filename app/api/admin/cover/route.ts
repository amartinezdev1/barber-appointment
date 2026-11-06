import {z} from 'zod';
import {tenantContext,requireOwner} from '../../../../lib/server/auth';
import {command} from '../../../../lib/server/commands';
import {supabaseAdmin} from '../../../../lib/server/supabase-admin';
import {assert,assertSameOrigin,errorResponse,json} from '../../../../lib/server/http';
import {identifier} from '../../../../lib/validation';
import {MAX_COVER_BYTES} from '../../../../lib/cover-images';
import {uploadAndSaveCover} from '../../../../lib/server/cover-upload';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 try{
  assertSameOrigin(request);
  assert((request.headers.get('content-type')||'').startsWith('multipart/form-data'),415,'Selecciona una imagen para la portada.');
  const maxBytes=MAX_COVER_BYTES+65536,reader=request.body?.getReader();assert(reader,400,'La solicitud no contiene una imagen.');
  const chunks:Uint8Array[]=[];let size=0;
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>maxBytes){await reader.cancel();assert(false,413,'La imagen debe pesar como máximo 2 MB.');}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  const form=await new Response(bytes,{headers:{'Content-Type':request.headers.get('content-type')!}}).formData();
  let raw:unknown;try{raw=JSON.parse(String(form.get('payload')));}catch{assert(false,400,'Revisa los datos de la barbería.');}
  const payload=z.object({action:z.literal('saveTenant'),tenant_id:identifier}).passthrough().parse(raw);
  const ctx=await tenantContext(payload.tenant_id);requireOwner(ctx);
  const file=form.get('file');assert(file instanceof File,400,'Selecciona una imagen.');
  const {result,hero_url}=await uploadAndSaveCover({storage:supabaseAdmin().storage,tenantId:ctx.tenant.id,file,previousUrl:ctx.tenant.hero_url,supabaseUrl:process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||'',save:hero_url=>command({...payload,hero_url})});
  return json({...result as Record<string,unknown>,hero_url});
 }catch(error){return errorResponse(error);}
}
