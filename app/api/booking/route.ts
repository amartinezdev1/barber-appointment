import {z} from 'zod';
import {body,errorResponse,json} from '../../../lib/server/http';
import {changeManagedBooking,managedBooking} from '../../../lib/server/repository';
import {identifier} from '../../../lib/validation';
export const dynamic='force-dynamic';
const input=z.object({token:z.string().regex(/^[a-f0-9]{64}$/),action:z.enum(['get','cancel','reschedule']),branch_id:identifier.optional(),service_id:identifier.optional(),barber_id:identifier.optional(),start_at:z.number().int().positive().optional()});
export async function POST(request:Request){try{const data=input.parse(await body(request));if(data.action==='get')return json(await managedBooking(data.token));if(data.action==='cancel')return json(await changeManagedBooking(data.token,'cancel'));const slot=z.object({branch_id:identifier,service_id:identifier,barber_id:identifier.optional(),start_at:z.number().int().positive()}).parse(data);return json(await changeManagedBooking(data.token,'reschedule',slot));}catch(e){return errorResponse(e);}}
