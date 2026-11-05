import Admin from '../../components/admin';
import {requireChatGPTUser} from '../chatgpt-auth';
export const dynamic='force-dynamic';
export const metadata={title:'Administración',robots:{index:false,follow:false}};
export default async function Page(){await requireChatGPTUser('/admin');return <Admin/>;}
