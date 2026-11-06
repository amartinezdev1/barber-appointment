import {z} from 'zod';
import {supabaseServer} from '../../../../lib/server/supabase';
import {assert,body,errorResponse,json} from '../../../../lib/server/http';
export async function POST(request:Request){try{
 const input=z.object({password:z.string().min(8,'Usa al menos 8 caracteres.').max(128)}).parse(await body(request));
 const client=await supabaseServer(),user=await client.auth.getUser();assert(!user.error&&user.data.user?.email_confirmed_at,401,'Abre primero el enlace que recibiste por correo.');
 const {error}=await client.auth.updateUser(input);assert(!error,400,'No se pudo guardar la contraseña. Usa una contraseña diferente de al menos 8 caracteres.');return json({ok:true});
}catch(error){return errorResponse(error);}}
