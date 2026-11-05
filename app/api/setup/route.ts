import {getChatGPTUser} from '../../chatgpt-auth';
import {one} from '../../../lib/server/db';
import {body,errorResponse,json} from '../../../lib/server/http';
import {initialize} from '../../../lib/server/seed';
export const dynamic='force-dynamic';
export const maxDuration=60;
export async function GET(){try{return json({initialized:!!await one('SELECT value FROM app_state WHERE key=?','ready'),signedIn:!!await getChatGPTUser()});}catch(e){return errorResponse(e);}}
export async function POST(request:Request){try{await body(request);return json(await initialize());}catch(e){return errorResponse(e);}}
