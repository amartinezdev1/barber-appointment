import {z} from 'zod';
import {supabaseServer} from '../../../../lib/server/supabase';
import {assert,body,errorResponse,json} from '../../../../lib/server/http';
const token=z.string().min(1).max(12000);
export async function POST(request:Request){try{
 const input=z.union([z.object({token_hash:token,type:z.enum(['invite','recovery'])}),z.object({access_token:token,refresh_token:token})]).parse(await body(request));
 const client=await supabaseServer();
 const result='token_hash' in input?await client.auth.verifyOtp(input):await client.auth.setSession(input);
 assert(!result.error,401,'El enlace venció o ya fue utilizado. Pide que te envíen otro.');
 const user=await client.auth.getUser();assert(!user.error&&user.data.user?.email_confirmed_at,401,'No se pudo confirmar la cuenta. Solicita otra invitación.');
 return json({ok:true});
}catch(error){return errorResponse(error);}}
