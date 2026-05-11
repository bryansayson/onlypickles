import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { pin } = await request.json();
  const adminPin = process.env.ADMIN_PIN ?? "1234";
  if (pin === adminPin) {
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false }, { status: 401 });
}
