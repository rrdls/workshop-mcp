import { load } from "cheerio";
import { URL } from "url";
import fetch from "node-fetch";

import * as dotenv from "dotenv";
dotenv.config();

export type Document = {
  pageContent: string;
  metadata: { source: string };
};

export async function fetchPage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Bad response");
    return await response.text();
  } catch (err) {
    console.error(`Failed to fetch ${url}:`, err);
    return null;
  }
}

export async function getAllDocUrls(baseUrl: string): Promise<string[]> {
  const html = await fetchPage(baseUrl);
  if (!html) return [];
  const $ = load(html);
  const domain = new URL(baseUrl).hostname;
  const urls = new Set<string>();

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    const full = new URL(href, baseUrl).toString();
    const parsed = new URL(full);
    if (
      parsed.hostname === domain &&
      !parsed.search &&
      !parsed.hash &&
      !/\.(png|jpg|jpeg|svg|webp|pdf|zip|js|css)$/i.test(parsed.pathname)
    ) {
      urls.add(full);
    }
  });

  return [...urls];
}

// export async function extractContentFromUrl(
//   url: string
// ): Promise<Document | null> {
//   const html = await fetchPage(url);
//   if (!html) return null;
//   const $ = load(html);
//   const headers = $("h1, h2")
//     .map((_, el) => $(el).text())
//     .get();
//   return {
//     metadata: { source: url },
//     pageContent: headers.join("\n") + "\n" + $.text(),
//   };
// }

const REMOVE_SELECTOR =
  "script, style, noscript, template, svg, link[rel='stylesheet'], head, meta";

export async function extractContentFromUrl(url: string): Promise<{
  metadata: { source: string; headers: string[] };
  pageContent: string;
} | null> {
  const html = await fetchPage(url);
  if (!html) return null;

  const $ = load(html);

  // 1) Cabeçalhos <h1>, <h2>
  const headers = $("h1, h2")
    .map((_, el) => $(el).text().trim())
    .get();

  // 2) Texto limpo ― clona o <body> e remove o que não queremos
  const bodyClone = $("body").clone();
  bodyClone.find(REMOVE_SELECTOR).remove();
  const text = bodyClone.text();

  return {
    metadata: { source: url, headers },
    pageContent: text,
  };
}

// const content = await extractContentFromUrl2("https://zod.dev/v4");
// console.log(content);

// const urls = await getAllDocUrls("https://zod.dev/v4");
// const pagesContent = await Promise.all(
//   urls.map((url) => extractContentFromUrl(url))
// );
