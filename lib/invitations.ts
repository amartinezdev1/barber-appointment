type MailError={message:string;code?:string;status?:number};
export type InvitationResult={sent:boolean;message:string;kind?:'invite'|'recovery'};
export type InvitationMailer={auth:{admin:{inviteUserByEmail:(email:string,options:{redirectTo:string})=>Promise<{error:MailError|null}>};resetPasswordForEmail:(email:string,options:{redirectTo:string})=>Promise<{error:MailError|null}>}};
export function invitationRedirect(value:string){
 const url=new URL(value),local=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
 if((url.protocol!=='https:'&&!(local&&url.protocol==='http:'))||url.username||url.password)throw new Error('La dirección de la aplicación debe usar HTTPS.');
 return new URL('/auth/accept',url.origin).href;
}
export function invitationFailure(error:MailError):InvitationResult{
 if(error.status===429||/rate.?limit|too many/i.test(error.message))return{sent:false,message:'El proveedor limitó los envíos. Espera unos minutos antes de reenviar la invitación.'};
 if(/email_address_not_authorized|email_address_invalid/.test(error.code||'')||/smtp|not authorized|sending emails to|email.*not allowed/i.test(error.message))return{sent:false,message:'El correo no se envió. Configura el remitente SMTP de Supabase para poder invitar a estas direcciones.'};
 return{sent:false,message:'El correo no se envió. Revisa la configuración de correo y las URL de redirección de Supabase antes de volver a intentarlo.'};
}
export async function sendAccessInvitation(mailer:InvitationMailer,email:string,redirectTo:string):Promise<InvitationResult>{
 const {error}=await mailer.auth.admin.inviteUserByEmail(email,{redirectTo});
 if(!error)return{sent:true,kind:'invite',message:'Invitación enviada. La persona podrá crear su contraseña desde el enlace del correo.'};
 if(['email_exists','user_already_exists'].includes(error.code||'')||/already (?:been )?registered|already exists/i.test(error.message)){
  const recovery=await mailer.auth.resetPasswordForEmail(email,{redirectTo});
  return recovery.error?invitationFailure(recovery.error):{sent:true,kind:'recovery',message:'La cuenta ya existe. Se envió un enlace para establecer su contraseña; también puede entrar con su contraseña actual.'};
 }
 return invitationFailure(error);
}
