export async function handler(event) {
  try {
    const u = new URL(event.rawUrl);
    const url = u.searchParams.get("url");
    const format = (u.searchParams.get("format") || "md").toLowerCase(); // md|html
    if (!url) return { statusCode: 400, body: "Missing ?url=" };

    // 1) Readable content
    const reader = await fetch("https://r.jina.ai/http://" + url.replace(/^https?:\/\//, ""));
    if (!reader.ok) throw new Error(`Reader failed: ${reader.status}`);
    let md = await reader.text();

    // 2) Trim EIN boilerplate
    const cutMarkers = [
      "\nAbout EIN Presswire", "Distribution Overview", "Newswires by",
      "Sample Distribution Report", "Live feed", "Featured", "Press Releases by"
    ];
    let cutAt = md.length;
    for (const m of cutMarkers) {
      const i = md.indexOf(m);
      if (i !== -1 && i < cutAt) cutAt = i;
    }
    md = md.slice(0, cutAt).trim();

    // Remove “URL Source / Published Time / Markdown Content” header lines if present
    md = md.replace(/^Title:.*\n/gm, "")
           .replace(/^URL Source:.*\n/gm, "")
           .replace(/^Published Time:.*\n/gm, "")
           .replace(/^Markdown Content:\n?/gm, "")
           .trim();

    // 3) Title: prefer og:title, fallback to <title>
    const page = await fetch(url);
    const html = await page.text();
    const og = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
    const t = og?.[1] || (html.match(/<title>([^<]+)<\/title>/i)?.[1]) || "Untitled";
    const title = t.trim();

    // 4) Return MD or basic HTML
    let content_markdown = md;
    let content_html = null;
    if (format === "html") {
      // very light MD->HTML for headings, images, links, bullets (keeps it simple)
      content_html = md
        .replace(/^## (.*)$/gm, "<h2>$1</h2>")
        .replace(/^### (.*)$/gm, "<h3>$1</h3>")
        .replace(/!\[(.*?)\]\((.*?)\)/g, '<img alt="$1" src="$2">')
        .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" rel="nofollow">$1</a>')
        .replace(/^\* (.*)$/gm, "<li>$1</li>")
        .replace(/(<li>[\s\S]*?<\/li>)/g, "<ul>$1</ul>")
        .replace(/\n{2,}/g, "</p><p>")
        .replace(/^/, "<p>").replace(/$/, "</p>");
    }

    const body = {
      ok: true,
      source_url: url,
      title,
      ...(format === "html" ? { content_html } : { content_markdown })
    };

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin":"*" },
      body: JSON.stringify(body)
    };
  } catch (e) {
    return { statusCode: 500, body: String(e) };
  }
}

