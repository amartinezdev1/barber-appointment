export const COVER_BUCKET='ritual-covers';
export const MAX_COVER_BYTES=2*1024*1024;
export const COVER_MIME_TYPES=['image/jpeg','image/png','image/webp'];
export function inspectCover(bytes:Uint8Array,declaredType:string){
 if(!bytes.length||bytes.length>MAX_COVER_BYTES)throw new Error('La imagen debe pesar como máximo 2 MB.');
 let mime='',extension='';
 if(bytes.length>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v)){mime='image/png';extension='png';}
 else if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255){mime='image/jpeg';extension='jpg';}
 else if(bytes.length>=12&&String.fromCharCode(...bytes.subarray(0,4))==='RIFF'&&String.fromCharCode(...bytes.subarray(8,12))==='WEBP'){mime='image/webp';extension='webp';}
 if(!mime||mime!==declaredType)throw new Error('Selecciona una imagen JPEG, PNG o WebP válida.');
 return{mime,extension};
}
export function managedCoverPath(value:string,supabaseUrl:string,tenantId:string){
 try{
  const url=new URL(value),base=new URL(supabaseUrl);
  const prefix=`/storage/v1/object/public/${COVER_BUCKET}/${encodeURIComponent(tenantId)}/`;
  if(url.origin!==base.origin||!url.pathname.startsWith(prefix))return null;
  const filename=url.pathname.slice(prefix.length);
  if(!/^[a-f0-9-]{36}\.(jpg|png|webp)$/.test(filename))return null;
  return `${tenantId}/${filename}`;
 }catch{return null;}
}
