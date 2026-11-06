// Eight local digits use Panama by default; explicit international prefixes are preserved.
export function normalizePhone(value:string):string {
 const compact=value.trim().replace(/[\s()-]/g,'');
 return /^\d{8}$/.test(compact)?'+507'+compact:compact;
}
