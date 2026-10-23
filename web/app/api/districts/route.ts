import { NextRequest, NextResponse } from "next/server";
import { GeoError, resolveDistricts } from "@/lib/geo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const address = sp.get("address")?.trim();
  const latS = sp.get("lat");
  const lngS = sp.get("lng");
  try {
    if (address) {
      if (address.length > 300) return NextResponse.json({ error: "Address too long" }, { status: 400 });
      return NextResponse.json(await resolveDistricts({ address }));
    }
    if (latS != null && lngS != null) {
      const lat = Number(latS);
      const lng = Number(lngS);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        return NextResponse.json({ error: "lat/lng must be valid numbers" }, { status: 400 });
      }
      return NextResponse.json(await resolveDistricts({ lat, lng }));
    }
    return NextResponse.json({ error: "Provide ?address=... or ?lat=..&lng=.." }, { status: 400 });
  } catch (e) {
    if (e instanceof GeoError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
