import { NextResponse } from "next/server";

const TOKEN = process.env.META_ACCESS_TOKEN!;
const ACCOUNT = process.env.META_AD_ACCOUNT_ID!;

async function metaPost(endpoint: string, params: Record<string, any>) {
  const body = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    body.append(k, typeof v === "object" ? JSON.stringify(v) : String(v));
  });
  body.append("access_token", TOKEN);
  const res = await fetch(`https://graph.facebook.com/v22.0/${endpoint}`, { method: "POST", body });
  return res.json();
}

export async function POST(req: Request) {
  try {
    const { action, name, description, retentionDays, rule, igPageId, videoIds, subtype } = await req.json();

    if (action === "create_ig_engagers") {
      // Create IG Business Profile engagement audience
      const result = await metaPost(`${ACCOUNT}/customaudiences`, {
        name: name || `IG Engagers ${retentionDays || 365}d`,
        subtype: "ENGAGEMENT",
        description: description || "Personas que interactuaron con el perfil de Instagram",
        rule: {
          inclusions: {
            operator: "or",
            rules: [{
              event_sources: [{ type: "ig_business", id: igPageId || "17841444471358900" }],
              retention_seconds: (retentionDays || 365) * 86400,
              filter: { operator: "or", filters: [{ field: "event", operator: "eq", value: "ig_business_profile_all" }] },
            }],
          },
        },
      });
      return NextResponse.json(result.error ? { error: result.error.message } : { success: true, audienceId: result.id });
    }

    if (action === "create_video_viewers") {
      const result = await metaPost(`${ACCOUNT}/customaudiences`, {
        name: name || `Video Viewers 75% - ${retentionDays || 90}d`,
        subtype: "ENGAGEMENT",
        description: description || "Personas que vieron el 75% de tus videos",
        rule: {
          inclusions: {
            operator: "or",
            rules: [{
              event_sources: [{ type: "video", id: videoIds?.[0] || "" }],
              retention_seconds: (retentionDays || 90) * 86400,
              filter: { operator: "and", filters: [{ field: "event", operator: "eq", value: "video_view_75_pct" }] },
            }],
          },
        },
      });
      return NextResponse.json(result.error ? { error: result.error.message } : { success: true, audienceId: result.id });
    }

    if (action === "create_lookalike") {
      const { sourceId, country, ratio } = await req.json();
      const result = await metaPost(`${ACCOUNT}/customaudiences`, {
        name: name || `LAL ${ratio || 1}% - ${country || "CL"}`,
        subtype: "LOOKALIKE",
        origin_audience_id: sourceId,
        lookalike_spec: {
          ratio: (ratio || 1) / 100,
          country: country || "CL",
          type: "similarity",
        },
      });
      return NextResponse.json(result.error ? { error: result.error.message } : { success: true, audienceId: result.id });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
