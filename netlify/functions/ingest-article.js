// netlify/functions/ingest-article.js
export async function handler(event) {
  try {
    const urlParam = new URL(event.rawUrl).searchParams.get("url");
    if (!urlParam) return { statusCode: 400, body: "Missing ?url=" };

    // 1. Fetch the article’s readable text
    const readerUrl = "https://r.jina.ai/http/" + urlParam.replace(/^https?:\/\//, "");
    const r = await fetch(readerUrl);
    if (!r.ok) throw new Error(`Reader failed: ${r.status}`);
    const rawMd = await r.text();

    if (!rawMd || rawMd.trim().length < 200) {
      return { statusCode: 422, body: "Could not extract readable content." };
    }

    // 2. Rewrite it with OpenAI
    const oai = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: [
              "You are a professional editor for BrightKey PR.",
              "Return JSON with: title, dek, html, tags (array), reading_minutes (int).",
              "Rules:",
              "- Don’t copy sentences verbatim; rewrite clearly in a professional voice.",
              "- Use H2/H3, short paragraphs, and bullet points where needed.",
              "- End with: <hr><p>Originally reported by the source. <a href='{{SOURCE_URL}}' rel='nofollow'>View original</a>.</p>"
            ].join('\n')
          },
          {
            role: "user",
            content: `SOURCE_URL: ${urlParam}\nRAW_MARKDOWN:\n${rawMd}`
          }
        ]
      })
    });

    if (!oai.ok) throw new Error(`OpenAI error: ${oai.status}`);
    const data = await oai.json();
    const content = JSON.parse(data.choices[0].message.content);

    // Add canonical link
    content.html = (content.html || "").replace("{{SOURCE_URL}}", urlParam);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({ ok: true, source_url: urlParam, ...content })
    };
  } catch (e) {
    return { statusCode: 500, body: String(e) };
  }
}
