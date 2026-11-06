'use client';
import {useEffect,useState} from 'react';
import {ImagePlus,Trash2} from 'lucide-react';
import {ErrorMessage,Field} from './ui';
import {MAX_COVER_BYTES,COVER_MIME_TYPES} from '../lib/cover-images';
export default function CoverPicker({value,file,disabled,onChange,onPreparingChange}:{value:string;file?:File;disabled:boolean;onPreparingChange:(value:boolean)=>void;onChange:(value:string,file?:File)=>void}){
 const [preview,setPreview]=useState(''),[error,setError]=useState(''),[processing,setProcessing]=useState(false);
 useEffect(()=>{if(!file){setPreview(value);return;}const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url);},[file,value]);
 async function select(file:File){
  setError('');if(!COVER_MIME_TYPES.includes(file.type)){setError('Selecciona una imagen JPEG, PNG o WebP.');return;}
  if(file.size>15*1024*1024){setError('Selecciona una imagen de hasta 15 MB.');return;}
  setProcessing(true);onPreparingChange(true);const objectUrl=URL.createObjectURL(file);
  try{
   const image=new Image();image.src=objectUrl;await image.decode();
   const scale=Math.min(1,1920/image.width,1920/image.height),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));const context=canvas.getContext('2d');if(!context)throw new Error('No se pudo preparar la imagen.');context.drawImage(image,0,0,canvas.width,canvas.height);
   const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('No se pudo preparar la imagen.')),'image/webp',.85));
   if(blob.size>MAX_COVER_BYTES)throw new Error('La imagen sigue siendo muy grande. Prueba una foto de menor resolución.');
   onChange('',new File([blob],'portada.webp',{type:blob.type}));
  }catch(error){setError(error instanceof Error?error.message:'No se pudo abrir la imagen.');}finally{URL.revokeObjectURL(objectUrl);setProcessing(false);onPreparingChange(false);}
 }
 return <fieldset className="cover-picker"><legend>Foto de portada</legend><ErrorMessage message={error}/>{preview?<img className="cover-preview" src={preview} alt="Vista previa de la portada"/>:<div className="cover-placeholder"><ImagePlus size={28}/><span>Elige una foto de tu barbería</span></div>}<label className="button secondary cover-file-button"><ImagePlus size={16}/>{processing?'Preparando imagen…':preview?'Cambiar imagen':'Cargar imagen'}<input aria-label="Cargar imagen de portada" type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled||processing} onChange={event=>{const file=event.currentTarget.files?.[0];event.currentTarget.value='';if(file)void select(file);}}/></label>{preview&&<button type="button" className="table-link danger-text" disabled={disabled||processing} onClick={()=>{onChange('');setError('');}}><Trash2 size={14}/>Quitar imagen</button>}<small>JPEG, PNG o WebP, hasta 15 MB. Se optimiza al seleccionarla y se carga al guardar los cambios.</small><details><summary>Usar una URL de imagen</summary><Field label="URL HTTPS"><input type="url" value={value} placeholder="https://…" disabled={disabled||processing} onChange={e=>onChange(e.target.value)}/></Field></details></fieldset>;
}
