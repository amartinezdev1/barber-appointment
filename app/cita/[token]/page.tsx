import ManageBooking from '../../../components/manage-booking';
export const metadata={title:'Tu cita',robots:{index:false,follow:false},referrer:'no-referrer'};
export default async function Page({params}:{params:Promise<{token:string}>}){return <ManageBooking token={(await params).token}/>;}
