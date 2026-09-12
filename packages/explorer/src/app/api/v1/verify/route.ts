import { run, toResponse } from "@/lib/api";

// GET /api/v1/verify?chain=<id>&token=<address>[&tokenId=<n>][&rpc=<url>][&<hint>=…] -> VerificationReport
export async function GET(request: Request): Promise<Response> {
  return toResponse(await run(new URL(request.url).searchParams));
}
