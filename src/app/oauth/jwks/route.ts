import { NextResponse } from "next/server";
import { publicKeys, signingKey } from "@/lib/oauth/keys";

/** Public keys that verify Blob's ID and access tokens. */
export async function GET() {
  let keys = await publicKeys();
  if (!keys.length) {
    await signingKey(); // first run: create one
    keys = await publicKeys();
  }
  return NextResponse.json(
    { keys },
    { headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=300, stale-while-revalidate=600" } },
  );
}
