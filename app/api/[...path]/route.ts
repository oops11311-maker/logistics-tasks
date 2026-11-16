import { handle } from "../../../src/server/handle";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function dispatch(request: Request): Promise<Response> {
  return handle(request);
}

export const GET = dispatch;
export const POST = dispatch;
export const PATCH = dispatch;
export const PUT = dispatch;
export const DELETE = dispatch;
