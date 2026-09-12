import { run, toResponse } from "@/lib/api";

// GET /api/v1/check/<check-id>?chain=<id>&token=<address>[…] -> CheckResult
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await ctx.params;
  return toResponse(await run(new URL(request.url).searchParams, id));
}
