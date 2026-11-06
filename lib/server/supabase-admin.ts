import {createClient} from '@supabase/supabase-js';
import {AppError} from './http.ts';
export function supabaseAdmin(){
 const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)throw new AppError(503,'Configura SUPABASE_SECRET_KEY en el servidor y vuelve a desplegar para cargar imágenes y enviar invitaciones.');
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
}
export function applicationUrl(){
 const value=process.env.RITUAL_APP_URL||(process.env.VERCEL_PROJECT_PRODUCTION_URL?`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`:undefined);
 if(!value)throw new AppError(503,'Falta configurar la dirección pública de la aplicación para enviar invitaciones.');
 return value;
}
