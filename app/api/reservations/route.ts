import {bookingInput} from '../../../lib/validation';
import {assert,body,errorResponse,json} from '../../../lib/server/http';
import {database,hash,statement} from '../../../lib/server/db';
import {createBooking} from '../../../lib/server/repository';
export const dynamic='force-dynamic';
export async function POST(request:Request){try{const input=bookingInput.parse(await body(request));const key=await hash((request.headers.get('cf-connecting-ip')||'local')+':'+input.slug),window=Math.floor(Date.now()/900000);const result=await database().batch([statement('INSERT INTO rate_limits (key,window,count) VALUES (?,?,1) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN rate_limits.window=excluded.window THEN rate_limits.count+1 ELSE 1 END,window=excluded.window RETURNING count',key,window)]);assert(Number((result[0].results[0] as {count:number})?.count)<=12,429,'Has realizado varios intentos. Espera unos minutos.');return json(await createBooking(input),201);}catch(e){return errorResponse(e);}}
