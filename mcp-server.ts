import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { load } from "cheerio";
import { URL } from "url";
import fetch from "node-fetch";

import { Chroma } from "@langchain/community/vectorstores/chroma";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";
import * as dotenv from "dotenv";
dotenv.config();

async function fetchPage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Bad response");
    return await response.text();
  } catch (err) {
    console.error(`Failed to fetch ${url}:`, err);
    return null;
  }
}

async function getAllDocUrls(baseUrl: string): Promise<string[]> {
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

async function extractContentFromUrl(
  url: string
): Promise<{ url: string; content: string } | null> {
  const html = await fetchPage(url);
  if (!html) return null;
  const $ = load(html);
  const headers = $("h1, h2")
    .map((_, el) => $(el).text())
    .get();
  return {
    url,
    content: headers.join("\n") + "\n" + $.text(),
  };
}

// const urls = await getAllDocUrls("https://zod.dev/v4");
// const pagesContent = await Promise.all(
//   urls.map((url) => extractContentFromUrl(url))
// );
