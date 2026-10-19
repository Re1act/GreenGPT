import { legislation, lookupZip, nearby, senators, stateOfficials } from "@/lib/brief/data";
import type { Brief } from "@/lib/brief/types";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const zip = (params.get("zip") ?? "").trim();
  const radius = Number(params.get("radius") ?? "25");
  if (!/^\d{5}$/.test(zip) || ![10,25,50,100].includes(radius)) return Response.json({error:"Enter a five-digit U.S. ZIP code and choose a radius."},{status:400});
  try {
    const place = await lookupZip(zip);
    const [facilities,bills,federal,state] = await Promise.allSettled([nearby(place,radius),legislation(place),senators(place.state),stateOfficials(place)]);
    const fallback = <T,>(message:string) => ({items:[] as T[],available:false,note:message});
    const brief: Brief = {place,radius,generatedAt:new Date().toISOString(),
      facilities:facilities.status==="fulfilled"?facilities.value:fallback("Facility records could not be loaded. This is not a finding that no facilities exist."),
      bills:bills.status==="fulfilled"?bills.value:fallback("Legislative records could not be loaded. Check the state bill search for current information."),
      officials:{items:[...(federal.status==="fulfilled"?federal.value:[]),...(state.status==="fulfilled"?state.value:[])],available:federal.status==="fulfilled",note:"U.S. senators come from the Senate directory. State matches, when available, use the ZIP’s representative point and may not be your district. Confirm House and state districts using your street address on the official lookup sites."},
    };
    return Response.json(brief,{headers:{"Cache-Control":"no-store"}});
  } catch(error) {
    const notFound=error instanceof Error && error.message==="NOT_FOUND";
    return Response.json({error:notFound?"That ZIP code was not found. Check the five digits and try again.":"ZIP lookup is temporarily unavailable. Please try again."},{status:notFound?404:503,headers:{"Cache-Control":"no-store"}});
  }
}
