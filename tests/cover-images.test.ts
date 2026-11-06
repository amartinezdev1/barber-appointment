import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inspectCover,managedCoverPath,MAX_COVER_BYTES} from '../lib/cover-images.ts';
test('el tipo de portada se comprueba contra los bytes reales',()=>{
 assert.equal(inspectCover(new Uint8Array([255,216,255,0]),'image/jpeg').extension,'jpg');
 assert.equal(inspectCover(new Uint8Array([137,80,78,71,13,10,26,10]),'image/png').extension,'png');
 assert.equal(inspectCover(new TextEncoder().encode('RIFFxxxxWEBP'),'image/webp').extension,'webp');
 for(const mime of ['image/svg+xml','image/png','text/html'])assert.throws(()=>inspectCover(new TextEncoder().encode('<svg></svg>'),mime));
 assert.throws(()=>inspectCover(new Uint8Array([255,216,255]),'image/png'));
});
test('se rechazan imágenes vacías y cuerpos demasiado grandes',()=>{
 assert.throws(()=>inspectCover(new Uint8Array(0),'image/jpeg'));
 assert.throws(()=>inspectCover(new Uint8Array(MAX_COVER_BYTES+1),'image/png'));
});
test('la limpieza de portadas solo permite archivos propios del negocio y del bucket esperado',()=>{
 const name='b42af58b-740b-4229-801c-b2e6fb1d882b.webp',base='https://example.supabase.co';
 assert.equal(managedCoverPath(`${base}/storage/v1/object/public/ritual-covers/tenant/${name}`,base,'tenant'),`tenant/${name}`);
 for(const url of [`https://evil.example/storage/v1/object/public/ritual-covers/tenant/${name}`,`${base}/storage/v1/object/public/ritual-covers/other/${name}`,`${base}/storage/v1/object/public/another-bucket/tenant/${name}`,`${base}/storage/v1/object/public/ritual-covers/tenant/../${name}`,`${base}/storage/v1/object/public/ritual-covers/tenant/arbitrary.jpg`])assert.equal(managedCoverPath(url,base,'tenant'),null);
});
