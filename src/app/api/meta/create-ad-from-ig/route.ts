import { NextResponse } from "next/server";

const TOKEN = process.env.META_ACCESS_TOKEN!;
const ACCOUNT = process.env.META_AD_ACCOUNT_ID!;

async function metaPost(endpoint: string, params: Record<string, string>) {
  const body = new URLSearchParams({ ...params, access_token: TOKEN });
  const res = await fetch(`https://graph.facebook.com/v22.0/${endpoint}`, { method: "POST", body });
  return res.json();
}

export async function POST(req: Request) {
  try {
    const { igPostId, igPermalink, campaignId, adsetId, primaryText, headline, cta, destinationUrl, adName } = await req.json();

    if (!igPostId || !campaignId || !adsetId) {
      return NextResponse.json({ error: "Missing required fields: igPostId, campaignId, adsetId" }, { status: 400 });
    }

    // Step 1: Create ad creative using the IG post
    const creativeResult = await metaPost(`${ACCOUNT}/adcreatives`, {
      name: adName || `IG-Ad-${igPostId}`,
      object_story_id: igPostId,
      ...(destinationUrl && {
        object_story_spec: JSON.stringify({
          link_data: {
            link: destinationUrl,
            message: primaryText || "",
            name: headline || "",
            call_to_action: { type: cta || "LEARN_MORE", value: { link: destinationUrl } },
          },
        }),
      }),
    });

    if (creativeResult.error) {
      // Try alternative: use existing post as ad
      const creativeAlt = await metaPost(`${ACCOUNT}/adcreatives`, {
        name: adName || `IG-Ad-${igPostId}`,
        source_instagram_media_id: igPostId.split("_")[0], // Extract media ID
        instagram_actor_id: igPostId.split("_")[1] || "",
      });

      if (creativeAlt.error) {
        return NextResponse.json({
          error: "Could not create creative",
          detail: creativeResult.error.message || creativeAlt.error.message,
          suggestion: "The IG post may need to be boosted directly from Ads Manager. Use the permalink to find it.",
          permalink: igPermalink,
        }, { status: 400 });
      }
    }

    const creativeId = creativeResult.id;

    // Step 2: Create the ad
    if (creativeId) {
      const adResult = await metaPost(`${ACCOUNT}/ads`, {
        name: adName || `Ad-from-IG-${new Date().toISOString().slice(0, 10)}`,
        adset_id: adsetId,
        creative: JSON.stringify({ creative_id: creativeId }),
        status: "PAUSED", // Always create paused for safety
      });

      if (adResult.error) {
        return NextResponse.json({
          error: "Creative created but ad creation failed",
          creativeId,
          detail: adResult.error.message,
        }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        adId: adResult.id,
        creativeId,
        status: "PAUSED",
        message: "Ad creado en estado PAUSED. Revisalo en Ads Manager antes de activar.",
        adsManagerLink: `https://adsmanager.facebook.com/adsmanager/manage/ads?act=${ACCOUNT.replace("act_", "")}&selected_ad_ids=${adResult.id}`,
      });
    }

    return NextResponse.json({
      error: "No se pudo crear el creative",
      suggestion: "Usa el boton Boost directamente en Instagram o crea el ad desde Ads Manager con el permalink",
      permalink: igPermalink,
    }, { status: 400 });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
