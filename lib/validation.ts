import {z} from 'zod';
export const identifier=z.string().min(1).max(100);
export const localDate=z.string().regex(/^\d{4}-\d{2}-\d{2}$/,'Fecha inválida.').refine(s=>!isNaN(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s,'Fecha inválida.');
export const name=z.string().trim().min(2,'Ingresa al menos 2 caracteres.').max(80);
export const phone=z.string().trim().transform(s=>s.replace(/[\s()-]/g,'')).pipe(z.string().regex(/^\+[1-9]\d{6,14}$/,'Usa un teléfono con código de país, por ejemplo +507 6000 0000.'));
export const bookingInput=z.object({slug:identifier,branch_id:identifier,service_id:identifier,barber_id:identifier.optional(),start_at:z.number().int().positive(),client_name:name,client_phone:phone,client_email:z.union([z.string().email(),z.literal('')]).default(''),whatsapp_consent:z.boolean().default(false),expected_price_cents:z.number().int().min(0).optional(),expected_minutes:z.number().int().min(1).optional()});
export const timezone=z.string().refine(s=>{try{new Intl.DateTimeFormat('en',{timeZone:s});return true;}catch{return false;}},'Zona horaria inválida.');
export const slug=z.string().trim().min(3).max(60).regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/,'Usa letras minúsculas, números y guiones.');
