import {getChatGPTUser} from '../../app/chatgpt-auth';
import {addDays,dateInZone,dayOfWeek,localInstant} from '../dates';
import {database,hash,one,statement,token} from './db';
import {assert} from './http';
import {inSitesRuntime} from './runtime-context';
export async function initialize(){
 const user=await getChatGPTUser();assert(user,401,'Inicia sesión antes de crear tu espacio.');
 if(!inSitesRuntime())assert(!!process.env.RITUAL_OWNER_EMAIL&&user.email.toLowerCase()===process.env.RITUAL_OWNER_EMAIL.trim().toLowerCase(),403,'Solo el correo configurado como RITUAL_OWNER_EMAIL puede inicializar la plataforma.');
 const ready=await one('SELECT value FROM app_state WHERE key=?','ready');assert(!ready,409,'El espacio ya está inicializado.');
 await database().batch([statement('INSERT INTO app_state (key,value) VALUES (?,?) ON CONFLICT(key) DO NOTHING','bootstrap_owner',user.userId)]);
 const owner=await one<{value:string}>('SELECT value FROM app_state WHERE key=?','bootstrap_owner');assert(owner?.value===user.userId,403,'Otro administrador está inicializando este espacio.');
 const commands:import('./database-contract').PreparedStatement[]=[];
 const insert=(table:string,row:Record<string,string|number|null>)=>{const keys=Object.keys(row);commands.push(statement(`INSERT OR IGNORE INTO ${table} (${keys.join(',')}) VALUES (${keys.map(()=>'?').join(',')})`,...Object.values(row)));};
 insert('profiles',{id:user.userId,email:user.email.toLowerCase(),name:user.displayName,is_platform_admin:1});
 for(const [tenant_id,slug,name] of [['ritual','el-ritual','El Ritual'],['studio','barber-studio','Barber Studio']]){
  insert('tenants',{id:tenant_id,slug,name,description:tenant_id==='ritual'?'Cortes con carácter, atención sin prisa y un espacio para ti. Reserva tu próximo ritual.':'Tu corte de siempre, con la atención que mereces.',tagline:tenant_id==='ritual'?'Un buen corte. Sin la espera.':'Tu estilo, en buenas manos.',accent:tenant_id==='ritual'?'#c2ed86':'#d8c5a5',hero_url:'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=1800&q=85',plan:tenant_id==='ritual'?'Multisede':'Esencial'});
  insert('memberships',{id:'owner-'+tenant_id,tenant_id,user_id:user.userId,role:'owner',branch_ids:'[]',barber_id:null});
 }
 const locations=[['centro','ritual','Centro','Calle 50 · Ciudad de Panamá'],['norte','ritual','Norte','Brisas del Golf · Ciudad de Panamá'],['principal','studio','Principal','San Francisco · Ciudad de Panamá']];
 for(const [id,tenant_id,name,address] of locations)insert('branches',{id,tenant_id,name,address});
 const staff=[['carlos','ritual','Carlos','Degradados y clásicos'],['luis','ritual','Luis','Corte y diseño de barba'],['marco','ritual','Marco','Estilo y precisión'],['ana','ritual','Ana','Cortes modernos'],['diego','ritual','Diego','Clásicos y barba'],['roberto','studio','Roberto','Estilo clásico'],['daniel','studio','Daniel','Degradados'],['jose','studio','José','Corte y barba']];
 for(const [id,tenant_id,name,bio] of staff)insert('barbers',{id,tenant_id,name,bio,initials:name.slice(0,1)});
 for(const tenant_id of ['ritual','studio'])for(const [key,name,description,minutes,price_cents] of [['cut','Corte de cabello','Tu estilo, bien definido.',30,1500],['combo','Corte + barba','El ritual completo.',60,2500],['beard','Perfilado de barba','Los detalles hacen la diferencia.',20,1000]] as const){const service_id=tenant_id+'-'+key;insert('services',{id:service_id,tenant_id,name,description,minutes,price_cents,buffer_minutes:5});for(const [branch_id,t] of locations)if(t===tenant_id)insert('branch_services',{tenant_id,branch_id,service_id,minutes:null,price_cents:null});for(const [barber_id,t] of staff)if(t===tenant_id)insert('barber_services',{tenant_id,barber_id,service_id,minutes:null,price_cents:null});}
 const today=dateInZone(Date.now(),'America/Panama'),sampleShifts:{id:string;tenant_id:string;barber_id:string;branch_id:string;date:string;start:number;end:number;rest:number}[]=[];
 for(let n=0;n<60;n++){const date=addDays(today,n),weekday=dayOfWeek(date);if(weekday===0)continue;
  const plan:[string,string,string,number,number,number][]=[['ritual','carlos',weekday%2?'centro':'norte',540,1020,720],['ritual','luis','centro',660,1140,900],['ritual','marco','centro',600,1080,780],['ritual','ana','norte',540,1020,720],['ritual','diego','norte',600,1080,780],['studio','roberto','principal',540,1020,720],['studio','daniel','principal',600,1080,780],['studio','jose','principal',660,1140,900]];
  for(const [tenant_id,barber_id,branch_id,start,end,rest] of plan){const id=`seed-${barber_id}-${date}`;insert('shifts',{id,tenant_id,barber_id,branch_id,date,start_at:localInstant(date,start,'America/Panama'),end_at:localInstant(date,end,'America/Panama'),break_start:localInstant(date,rest,'America/Panama'),break_end:localInstant(date,rest+60,'America/Panama')});if(n>0&&n<8)sampleShifts.push({id,tenant_id,barber_id,branch_id,date,start,end,rest});}
 }
 const names=['Andrés M.','Sergio R.','Miguel A.','Jorge P.','Mateo G.','Alex C.'];
 for(let i=0;i<sampleShifts.length;i++){const sh=sampleShifts[i],start_at=localInstant(sh.date,sh.start+60,'America/Panama');insert('bookings',{id:'seed-booking-'+sh.id,tenant_id:sh.tenant_id,branch_id:sh.branch_id,barber_id:sh.barber_id,service_id:sh.tenant_id+'-cut',status:'confirmed',start_at,end_at:start_at+30*60000,busy_until:start_at+35*60000,client_name:names[i%names.length],client_phone:'+50760000000',client_email:'',price_cents:1500,minutes:30,service_name:'Corte de cabello',whatsapp_consent:0,reference:'DEMO-'+String(i).padStart(4,'0'),manage_hash:await hash(token()),created_at:Date.now(),version:1});}
 for(let i=0;i<commands.length;i+=40)await database().batch(commands.slice(i,i+40));
 await database().batch([statement('INSERT INTO app_state (key,value) VALUES (?,?) ON CONFLICT(key) DO NOTHING','ready','1')]);
 return{ok:true};
}
