import {z} from 'zod';
import {supabaseServer} from '../../../../lib/server/supabase';
import {assert,body,errorResponse,json} from '../../../../lib/server/http';
export async function POST(request:Request){try{const input=z.object({email:z.string().email(),password:z.string().min(1).max(512)}).parse(await body(request));const {error}=await(await supabaseServer()).auth.signInWithPassword(input);assert(!error,401,'Correo o contraseña incorrectos. Comprueba también que la cuenta esté confirmada.');return json({ok:true});}catch(e){return errorResponse(e);}}
