export type QueryResult<T=Record<string,unknown>>={results:T[];meta:{changes:number}};
export interface PreparedStatement {
 bind(...values:unknown[]):PreparedStatement;
 all<T=Record<string,unknown>>():Promise<QueryResult<T>>;
 first<T=Record<string,unknown>>():Promise<T|null>;
 run():Promise<QueryResult>;
}
export interface Database {prepare(sql:string):PreparedStatement;batch(statements:PreparedStatement[]):Promise<QueryResult[]>;}
