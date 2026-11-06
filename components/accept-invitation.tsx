'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowRight} from 'lucide-react';
import {post} from '../lib/client';
import {ErrorMessage,Field,Logo,Spinner} from './ui';
export default function AcceptInvitation({hasSession,configured}:{hasSession:boolean;configured:boolean}){
 const [ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const verification=useRef<Promise<unknown>|null>(null);
 useEffect(()=>{
  let active=true;
  if(!verification.current){
   verification.current=(async()=>{
    const url=new URL(window.location.href),fragment=new URLSearchParams(url.hash.slice(1));
    const access_token=fragment.get('access_token'),refresh_token=fragment.get('refresh_token'),token_hash=url.searchParams.get('token_hash'),type=url.searchParams.get('type');
    const failed=fragment.has('error')||url.searchParams.has('error');
    window.history.replaceState(null,'',url.pathname);
    if(!configured)throw new Error('El acceso necesita completar la configuración de Supabase.');
    if(failed)throw new Error('El enlace venció o ya fue utilizado. Pide otra invitación.');
    if(access_token&&refresh_token)return post('/api/auth/accept',{access_token,refresh_token});
    if(token_hash&&(type==='invite'||type==='recovery'))return post('/api/auth/accept',{token_hash,type});
    if(!hasSession)throw new Error('Abre el enlace completo que recibiste por correo o solicita otra invitación.');
   })();
  }
  verification.current.then(()=>{if(active)setReady(true);}).catch(e=>{if(active)setError(e instanceof Error?e.message:'No se pudo verificar el enlace.');});
  return()=>{active=false;};
 },[hasSession,configured]);
 return <main className="admin-onboarding"><Logo/><span className="eyebrow">ACCESO DE TU EQUIPO</span><h1>Tu espacio<br/>te espera.</h1><p>Establece tu contraseña para entrar a las barberías a las que te dieron acceso.</p><ErrorMessage message={error}/>{!ready&&!error&&<Spinner label="Verificando tu enlace…"/>}{ready&&<form className="editor-form invitation-password-form" onSubmit={async e=>{e.preventDefault();const form=new FormData(e.currentTarget),password=String(form.get('password'));if(password!==form.get('confirm')){setError('Las contraseñas no coinciden.');return;}setBusy(true);setError('');try{await post('/api/auth/password',{password});window.location.assign('/admin');}catch(error){setError(error instanceof Error?error.message:'No se pudo guardar.');setBusy(false);}}}><Field label="Nueva contraseña" hint="Usa al menos 8 caracteres."><input name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} disabled={busy}/></Field><Field label="Repite la contraseña"><input name="confirm" type="password" autoComplete="new-password" required minLength={8} maxLength={128} disabled={busy}/></Field><button className="button primary" disabled={busy}>{busy?'Guardando…':'Guardar contraseña y entrar'}<ArrowRight size={16}/></button></form>}<a className="text-link" href="/login">Ya tengo contraseña · Iniciar sesión</a></main>;
}
