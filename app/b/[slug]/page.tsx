import {notFound} from 'next/navigation';
import PublicBooking from '../../../components/public-booking';
import {publicData} from '../../../lib/server/repository';
import {AppError} from '../../../lib/server/http';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{slug:string}>}){const {slug}=await params;try{return <PublicBooking data={await publicData(slug)}/>;}catch(e){if(e instanceof AppError&&e.status===404)notFound();throw e;}}
