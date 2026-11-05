import {AsyncLocalStorage} from 'node:async_hooks';
import type {Database} from './database-contract';
const sitesContext=new AsyncLocalStorage<{database:D1Database}|undefined>();
export function runWithSitesDatabase<T>(database:D1Database|undefined,run:()=>T):T {return sitesContext.run(database?{database}:undefined,run);}
export function sitesDatabase():D1Database|undefined{return sitesContext.getStore()?.database;}
export function inSitesRuntime():boolean{return !!sitesContext.getStore();}
export function sitesAdapter():Database|undefined{return sitesDatabase() as unknown as Database|undefined;}
