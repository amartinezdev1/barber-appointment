import type {Database} from './database-contract';
import {sitesAdapter} from './runtime-context';
import {postgresDatabase} from './postgres';
export function database():Database{return sitesAdapter()??postgresDatabase;}
export async function rows<T>(sql:string,...params:unknown[]):Promise<T[]>{return(await database().prepare(sql).bind(...params).all<T>()).results;}
export async function one<T>(sql:string,...params:unknown[]):Promise<T|null>{return database().prepare(sql).bind(...params).first<T>();}
export async function run(sql:string,...params:unknown[]){return database().prepare(sql).bind(...params).run();}
export function statement(sql:string,...params:unknown[]){return database().prepare(sql).bind(...params);}
export function id(){return crypto.randomUUID();}
export async function hash(value:string):Promise<string>{return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),x=>x.toString(16).padStart(2,'0')).join('');}
export function token(){return Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');}
