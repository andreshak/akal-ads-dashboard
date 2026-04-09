import { NextResponse } from "next/server";

const TOKEN = process.env.META_ACCESS_TOKEN!;

async function metaPost(entityId: string, params: Record<string, string>) {
  const body = new URLSearchParams({ ...params, access_token: TOKEN });
  const res = await fetch(`https://graph.facebook.com/v22.0/${entityId}`, {
    method: "POST",
    body,
  });
  const data = await res.json();
  if (data.error) throw new Error(JSON.stringify(data.error));
  return data;
}

export async function POST(req: Request) {
  try {
    const { action, entityId, entityName, params } = await req.json();

    if (!entityId || !action) {
      return NextResponse.json({ error: "Missing entityId or action" }, { status: 400 });
    }

    let result;
    switch (action) {
      case "pause":
        result = await metaPost(entityId, { status: "PAUSED" });
        break;
      case "activate":
        result = await metaPost(entityId, { status: "ACTIVE" });
        break;
      case "update_budget":
        if (!params?.daily_budget) {
          return NextResponse.json({ error: "Missing daily_budget" }, { status: 400 });
        }
        result = await metaPost(entityId, { daily_budget: String(Math.round(parseFloat(params.daily_budget) * 100)) });
        break;
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      action,
      entityId,
      entityName,
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Action failed" },
      { status: 500 }
    );
  }
}
