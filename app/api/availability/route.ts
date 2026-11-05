import {z} from 'zod';
import {identifier,localDate} from '../../../lib/validation';
import {errorResponse,json} from '../../../lib/server/http';
import {getSlots} from '../../../lib/server/repository';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{const q=z.object({slug:identifier,branch:identifier,service:identifier,date:localDate,barber:identifier.optional()}).parse(Object.fromEntries(new URL(request.url).searchParams));return json({slots:await getSlots(q.slug,q.branch,q.service,q.date,q.barber)});}catch(e){return errorResponse(e);}}
