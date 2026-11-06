import AcceptInvitation from '../../../components/accept-invitation';
import {supabaseConfig,supabaseServer} from '../../../lib/server/supabase';
export const dynamic='force-dynamic';
export const metadata={title:'Activa tu acceso',robots:{index:false,follow:false},referrer:'no-referrer' as const};
export default async function Page(){
 const configured=!!supabaseConfig();
 const user=configured?(await(await supabaseServer()).auth.getUser()).data.user:null;
 return <AcceptInvitation hasSession={!!user?.email_confirmed_at} configured={configured}/>;
}
