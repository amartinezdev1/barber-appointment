import type {Pool,PoolClient,QueryResult as PgResult} from 'pg';
import type {Database,PreparedStatement,QueryResult} from './database-contract';
import {toPostgres} from './postgres-sql';
let poolPromise:Promise<Pool>|undefined;
function connection():Promise<Pool>{
 return poolPromise??=(async()=>{
  const pg=await import('pg');
  pg.types.setTypeParser(20,value=>{const number=Number(value);if(!Number.isSafeInteger(number))throw new Error('El entero excede el rango seguro.');return number;});
  if(!process.env.DATABASE_URL)throw new Error('DATABASE_NOT_CONFIGURED');
  const url=new URL(process.env.DATABASE_URL),local=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
  // URL SSL options must not override the verified TLS configuration below.
  for(const parameter of ['sslmode','sslcert','sslkey','sslrootcert'])url.searchParams.delete(parameter);
  const ca=process.env.DATABASE_CA_CERT?.replace(/\\n/g,'\n');
  const pool=new pg.Pool({connectionString:url.toString(),max:1,connectionTimeoutMillis:10000,idleTimeoutMillis:10000,ssl:local?undefined:{rejectUnauthorized:true,...(ca?{ca}:{})},allowExitOnIdle:true});
  pool.on('error',()=>console.error('PostgreSQL: se perdió una conexión inactiva.'));
  return pool;
 })().catch(error=>{poolPromise=undefined;throw error;});
}
function result<T=Record<string,unknown>>(r:PgResult):QueryResult<T>{return{results:r.rows as T[],meta:{changes:r.rowCount??0}};}
class PgStatement implements PreparedStatement {
 constructor(readonly sql:string,readonly values:unknown[]=[]){ }
 bind(...values:unknown[]){return new PgStatement(this.sql,values);}
 async all<T>():Promise<QueryResult<T>>{return result<T>(await(await connection()).query(toPostgres(this.sql),this.values));}
 async first<T>():Promise<T|null>{return(await this.all<T>()).results[0]??null;}
 async run():Promise<QueryResult>{return this.all();}
 async execute(client:PoolClient){return result(await client.query(toPostgres(this.sql),this.values));}
}
export const postgresDatabase:Database={prepare(sql){return new PgStatement(sql);},async batch(statements){const client=await(await connection()).connect();try{await client.query('BEGIN');const results=[];for(const statement of statements){if(!(statement instanceof PgStatement))throw new Error('La transacción contiene un adaptador incorrecto.');results.push(await statement.execute(client));}await client.query('COMMIT');return results;}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}}};
