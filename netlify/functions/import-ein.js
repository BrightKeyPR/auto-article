export async function handler(event) {
  try {
    const url = new URL(event.rawUrl).searchParams.get("url");
    if (!url) return { statusCode: 400, body: "Missing ?url=" };

    const reader = await fetch("https://r.jina.ai/http/" + url.replace(/^https?:\/\//, ""));
    if (!reader.ok) throw new Error(`Reader failed: ${reader.status}`);
    const contentMarkdown = await reader.text();

    const page = await fetch(url);
    const html = await page.text();
    const match = html.match(/<title>([^<]+)<\/title>/i);
    const title = match ? match[1].trim() : "Untitled";

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ ok: true, source_url: url, title, content_markdown: contentMarkdown })
    };
  } catch (e) {
    return { statusCode: 500, body: String(e) };
  }
}
