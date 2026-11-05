'use client';
import {useState} from 'react';
import {LogOut} from 'lucide-react';
import {post} from '../lib/client';
export default function Logout({provider,compact=false}:{provider:'sites'|'supabase';compact?:boolean}){const [busy,setBusy]=useState(false);if(provider==='sites')return <a href="/signout-with-chatgpt?return_to=/" className={compact?'icon-button':'text-link'} aria-label="Cerrar sesión">{compact?<LogOut size={16}/>:'Cambiar de cuenta'}</a>;return <button type="button" className={compact?'icon-button':'text-link'} aria-label="Cerrar sesión" disabled={busy} onClick={async()=>{setBusy(true);try{await post('/api/auth/logout',{});window.location.assign('/login');}catch{setBusy(false);}}}>{compact?<LogOut size={16}/>:busy?'Saliendo…':'Cambiar de cuenta'}</button>;}
