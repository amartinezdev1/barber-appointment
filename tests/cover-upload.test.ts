import {test} from 'node:test';
import assert from 'node:assert/strict';
import {uploadAndSaveCover,type CoverStorage} from '../lib/server/cover-upload.ts';
const base='https://example.supabase.co',previous='tenant/b42af58b-740b-4229-801c-b2e6fb1d882b.webp';
function fixture(){
 const events:{action:string;value?:unknown}[]=[];
 const bucket={async upload(path:string){events.push({action:'upload',value:path});return{error:null};},getPublicUrl(path:string){return{data:{publicUrl:base+'/storage/v1/object/public/ritual-covers/'+path}};},async remove(paths:string[]){events.push({action:'remove',value:paths});return{error:null};}};
 const storage:CoverStorage={getBucket:async()=>({data:{public:true},error:null}),createBucket:async(_name,options)=>{events.push({action:'create',value:options});return{error:null};},from:()=>bucket};
 const input={storage,tenantId:'tenant',file:new File([new Uint8Array([255,216,255,0])],'foto.jpg',{type:'image/jpeg'}),previousUrl:base+'/storage/v1/object/public/ritual-covers/'+previous,supabaseUrl:base,save:async(url:string)=>{events.push({action:'save',value:url});return{ok:true};}};
 return{storage,bucket,input,events};
}
test('se guarda la URL y se limpia la portada anterior solo después de persistir',async()=>{
 const f=fixture(),result=await uploadAndSaveCover(f.input);assert.equal(result.result.ok,true);assert.match(result.hero_url,/^https:\/\/example.supabase.co\/storage\/v1\/object\/public\/ritual-covers\/tenant\/[a-f0-9-]+\.jpg$/);assert.deepEqual(f.events.map(e=>e.action),['upload','save','remove']);assert.deepEqual(f.events[2].value,[previous]);
});
test('un fallo al guardar elimina la nueva carga y conserva la portada anterior',async()=>{
 const f=fixture();f.input.save=async()=>{throw new Error('No se pudo guardar.');};await assert.rejects(uploadAndSaveCover(f.input),/No se pudo guardar/);assert.deepEqual(f.events.map(e=>e.action),['upload','remove']);assert.deepEqual(f.events[1].value,[f.events[0].value]);assert.notEqual((f.events[1].value as string[])[0],previous);
});
test('no se borran imágenes de otras barberías ni de proveedores externos',async()=>{
 for(const previousUrl of [base+'/storage/v1/object/public/ritual-covers/other/'+previous.split('/')[1],'https://images.example.com/cover.jpg']){const f=fixture();await uploadAndSaveCover({...f.input,previousUrl});assert.deepEqual(f.events.map(e=>e.action),['upload','save']);}
});
test('se prepara un bucket público acotado cuando no existe',async()=>{
 const f=fixture();f.storage.getBucket=async()=>({data:null,error:{message:'Bucket not found'}});await uploadAndSaveCover(f.input);assert.equal(f.events[0].action,'create');assert.deepEqual(f.events[0].value,{public:true,fileSizeLimit:2097152,allowedMimeTypes:['image/jpeg','image/png','image/webp']});
});
test('no se cambia un bucket privado existente ni se ignora un fallo de acceso',async()=>{
 for(const response of [{data:{public:false},error:null},{data:null,error:{message:'Unauthorized'}}]){const f=fixture();f.storage.getBucket=async()=>response;await assert.rejects(uploadAndSaveCover(f.input));assert.deepEqual(f.events,[]);}
});
test('si falla la carga, no se guarda ni se borra la portada anterior',async()=>{
 const f=fixture();f.bucket.upload=async()=>({error:{message:'Failed upload'}} as never);await assert.rejects(uploadAndSaveCover(f.input),/cargar/);assert.deepEqual(f.events,[]);
});
