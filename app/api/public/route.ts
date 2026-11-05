import {publicData} from '../../../lib/server/repository';
import {one,rows} from '../../../lib/server/db';
import {errorResponse,json} from '../../../lib/server/http';
import {identifier} from '../../../lib/validation';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{const slug=new URL(request.url).searchParams.get('slug');if(slug)return json(await publicData(identifier.parse(slug)));const ready=await one('SELECT value FROM app_state WHERE key=?','ready');if(!ready)return json({tenants:[],initialized:false});return json({initialized:true,tenants:await rows('SELECT id,name,slug,description,tagline,hero_url,accent FROM tenants WHERE status=? ORDER BY name','active')});}catch(e){return errorResponse(e);}}
