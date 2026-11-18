import { handle } from "../../../src/lib/router";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return handle(request);
}

export function POST(request: Request) {
  return handle(request);
}

export function PATCH(request: Request) {
  return handle(request);
}

export function PUT(request: Request) {
  return handle(request);
}

export function DELETE(request: Request) {
  return handle(request);
}
