import {COVER_BUCKET,COVER_MIME_TYPES,MAX_COVER_BYTES,inspectCover,managedCoverPath} from '../cover-images.ts';
import {assert} from './http.ts';
type StorageError={message:string};
export type CoverStorage={
 getBucket:(name:string)=>Promise<{data:{public:boolean}|null;error:StorageError|null}>;
 createBucket:(name:string,options:{public:boolean;fileSizeLimit:number;allowedMimeTypes:string[]})=>Promise<{error:StorageError|null}>;
 from:(name:string)=>{
  upload:(path:string,file:File,options:{contentType:string;cacheControl:string;upsert:boolean})=>Promise<{error:StorageError|null}>;
  getPublicUrl:(path:string)=>{data:{publicUrl:string}};
  remove:(paths:string[])=>Promise<{error:StorageError|null}>;
 };
};
export async function uploadAndSaveCover<T>({storage,tenantId,file,previousUrl,supabaseUrl,save}:{storage:CoverStorage;tenantId:string;file:File;previousUrl:string;supabaseUrl:string;save:(url:string)=>Promise<T>}){
 let image:{mime:string;extension:string};try{image=inspectCover(new Uint8Array(await file.arrayBuffer()),file.type);}catch(error){assert(false,400,error instanceof Error?error.message:'Imagen inválida.');}
 const existing=await storage.getBucket(COVER_BUCKET);
 if(existing.error){
  assert(/bucket.*not found/i.test(existing.error.message),503,'No se pudo acceder al almacenamiento de imágenes.');
  const created=await storage.createBucket(COVER_BUCKET,{public:true,fileSizeLimit:MAX_COVER_BYTES,allowedMimeTypes:COVER_MIME_TYPES});
  if(created.error){const retry=await storage.getBucket(COVER_BUCKET);assert(retry.data?.public,503,'No se pudo preparar el almacenamiento de portadas.');}
 }else assert(existing.data?.public,503,'El almacenamiento de portadas debe estar configurado como público.');
 const path=`${encodeURIComponent(tenantId)}/${crypto.randomUUID()}.${image.extension}`,bucket=storage.from(COVER_BUCKET);
 const uploaded=await bucket.upload(path,file,{contentType:image.mime,cacheControl:'3600',upsert:false});
 assert(!uploaded.error,503,'No se pudo cargar la imagen. Revisa la configuración del almacenamiento.');
 const hero_url=bucket.getPublicUrl(path).data.publicUrl;
 let result:T;try{result=await save(hero_url);}catch(error){try{await bucket.remove([path]);}catch{/* Keep the original validation/database error. */}throw error;}
 const previous=managedCoverPath(previousUrl,supabaseUrl,tenantId);
 if(previous&&previous!==path){try{const removed=await bucket.remove([previous]);if(removed.error)console.warn('No se pudo limpiar la portada anterior.');}catch{console.warn('No se pudo limpiar la portada anterior.');}}
 return{result,hero_url};
}
