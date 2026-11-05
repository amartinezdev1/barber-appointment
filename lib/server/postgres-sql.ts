const TABLES=new Set(['app_state','profiles','tenants','branches','barbers','services','memberships','access_grants','branch_services','barber_services','shifts','bookings','notifications','audit','rate_limits']);
// Only our internal parameterized SQL passes here. Literal values are never concatenated.
export function toPostgres(sql:string):string {
 const ignore=/^\s*INSERT\s+OR\s+IGNORE\s+INTO\b/i.test(sql);
 sql=sql.replace(/^\s*INSERT\s+OR\s+IGNORE\s+INTO\b/i,'INSERT INTO');
 let result='',index=0,parameter=0;
 while(index<sql.length){const c=sql[index];
  if(c==="'"||c==='"'){const quote=c;result+=c;index++;while(index<sql.length){const next=sql[index++];result+=next;if(next===quote){if(sql[index]===quote){result+=sql[index++];}else break;}}continue;}
  if(c==='?'){result+='$'+(++parameter);index++;continue;}
  if(/[A-Za-z_]/.test(c)){let end=index+1;while(end<sql.length&&/[A-Za-z_0-9]/.test(sql[end]))end++;const word=sql.slice(index,end),lower=word.toLowerCase();result+=TABLES.has(lower)&&sql[index-1]!=='.'?`ritual.${word}`:lower==='window'?'"window"':word;index=end;continue;}
  result+=c;index++;
 }
 if(ignore)result=result.replace(/;?\s*$/,' ON CONFLICT DO NOTHING');
 return result;
}
