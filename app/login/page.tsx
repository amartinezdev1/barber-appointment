import Login from '../../components/login';
import {Logo} from '../../components/ui';
import {supabaseConfig} from '../../lib/server/supabase';
export const dynamic='force-dynamic';
export const metadata={title:'Iniciar sesión',robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<{return_to?:string}>}){if(!supabaseConfig())return <main className="admin-onboarding"><Logo/><h1>Prepara tu espacio.</h1><p>El sitio está compilado. Para activar la administración, configura Supabase y PostgreSQL en Vercel siguiendo <code>docs/VERCEL.md</code>.</p><p>Variables necesarias: <code>DATABASE_URL</code>, <code>SUPABASE_URL</code>, <code>SUPABASE_PUBLISHABLE_KEY</code> y <code>RITUAL_OWNER_EMAIL</code>.</p><a href="/" className="text-link">Volver al inicio</a></main>;const {return_to}=await searchParams;const safe=return_to?.startsWith('/')&&!return_to.startsWith('//')&&!return_to.startsWith('/login')?return_to:'/admin';return <Login returnTo={safe}/>;}
