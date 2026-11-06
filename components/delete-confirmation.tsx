'use client';
import {useState} from 'react';
import {Trash2} from 'lucide-react';
import {ErrorMessage,Field,Modal} from './ui';
export type DeleteKind='tenant'|'branch'|'barber'|'service'|'shift'|'booking'|'grant'|'notification';
export type DeleteTarget={kind:DeleteKind;id:string;tenant_id:string;label:string;version?:number};
export const deleteActions:Record<DeleteKind,string>={tenant:'deleteTenant',branch:'deleteBranch',barber:'deleteBarber',service:'deleteService',shift:'deleteShift',booking:'deleteBooking',grant:'revokeAccess',notification:'deleteNotification'};
const titles:Record<DeleteKind,string>={tenant:'Eliminar barbería',branch:'Eliminar sucursal',barber:'Eliminar barbero',service:'Eliminar servicio',shift:'Eliminar turno',booking:'Eliminar reserva',grant:'Eliminar acceso',notification:'Eliminar aviso'};
const details:Record<DeleteKind,string>={
 tenant:'Se eliminarán sus sucursales, equipo, servicios, turnos, reservas y accesos. Esta acción es permanente.',
 branch:'La sucursal debe estar libre de reservas, turnos y accesos asignados. La barbería debe conservar al menos una sucursal activa.',
 barber:'El barbero debe estar libre de reservas, turnos y accesos vinculados. Si necesitas conservar su historial, puedes archivarlo desde Editar.',
 service:'Se eliminarán sus asignaciones a sucursales y barberos. Si tiene reservas asociadas, primero debes eliminarlas o archivar el servicio desde Editar.',
 shift:'Se eliminará únicamente este turno. Si sostiene reservas vigentes, tendrás que reprogramarlas o cancelarlas primero.',
 booking:'Se eliminarán esta reserva y sus avisos asociados. El enlace privado de la cita dejará de funcionar y el horario quedará disponible si cumple las reglas de reserva.',
 grant:'La persona perderá el acceso a esta barbería. Su cuenta de inicio de sesión se conserva.',
 notification:'Se eliminará este aviso del registro de la barbería. La reserva asociada se conserva; los mensajes ya enviados no se pueden retirar.',
};
export default function DeleteConfirmation({target,onClose,onConfirm}:{target:DeleteTarget;onClose:()=>void;onConfirm:(target:DeleteTarget,confirmation:string)=>Promise<void>}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[confirmation,setConfirmation]=useState('');
 return <Modal title={titles[target.kind]} onClose={()=>{if(!busy)onClose();}}>
  <form className="editor-form delete-confirmation" onSubmit={async event=>{event.preventDefault();if(busy)return;setBusy(true);setError('');try{await onConfirm(target,confirmation);}catch(e){setError(e instanceof Error?e.message:'No se pudo eliminar.');}finally{setBusy(false);}}}>
   <p>Vas a eliminar <strong>{target.label}</strong>.</p><p className="muted">{details[target.kind]}</p><ErrorMessage message={error}/>
   {target.kind==='tenant'&&<Field label="Escribe el nombre de la barbería para confirmar"><input value={confirmation} onChange={e=>setConfirmation(e.target.value)} autoComplete="off" spellCheck={false} disabled={busy}/></Field>}
   <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose} disabled={busy}>Volver</button><button type="submit" className="button danger" disabled={busy||(target.kind==='tenant'&&confirmation!==target.label)}><Trash2 size={16}/>{busy?'Eliminando…':titles[target.kind]}</button></div>
  </form>
 </Modal>;
}
