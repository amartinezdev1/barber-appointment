import {supabaseServer} from '../../../../lib/server/supabase';
import {body,errorResponse,json} from '../../../../lib/server/http';
export async function POST(request:Request){try{await body(request);await(await supabaseServer()).auth.signOut();return json({ok:true});}catch(e){return errorResponse(e);}}
