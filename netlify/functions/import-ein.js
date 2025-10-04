export async function handler(event) {
  try {
    const url = new URL(event.rawUrl).searchParams.get("url");
    if (!url) return { statusCode: 400, body: "Missing ?url=" };

    // 1) Get readable markdown for the page
    const reader = await fetch("https://r.jina.ai/http://" + url.replace(/^https?:\/\//, ""));
    if (!reader.ok) throw new Error(`Reader failed: ${reader.status}`);
    let md = await reader.text();

    // 2) Basic cleanup: keep the main article, drop EIN boilerplate sections
    const cutMarkers = [
      "About EIN Presswire",      // common footer section
      "Distribution",             // “Distribution Overview”
      "Newswires by",             // “Newswires by Country/State/Industry”
      "Live feed",                // site links
      "Sample Distribution Report",
      "Featured",                 // sidebar blocks
      "Press Releases by",        // category lists
    ];
    let cutAt = md.length;
    for (const m of cutMarkers) {
      const i = md.indexOf(m);
      if (i !== -1 && i < cutAt) cutAt = i;
    }
    md = md.slice(0, cutAt).trim();

    // Optional: remove any trailing mega-link lists
    md = md.replace(/\n\* \[.*?\]\(https?:\/\/.*?\)\n/gs, "\n");

    // 3) Get a simple <title> for the post title
    const page = await fetch(url);
    const html = await page.text();
    const match = html.match(/<title>([^<]+)<\/title>/i);
    const title = match ? match[1].trim() : "Untitled";

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ ok: true, source_url: url, title, content_markdown: md })
    };
  } catch (e) {
    return { statusCode: 500, body: String(e) };
  }
}
