import { generateObject } from "ai";
import getSitemapLinks from "./sitemap";
import * as cheerio from "cheerio";
import { z } from "zod";
import { openai } from "@ai-sdk/openai";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

export default async function start({
  mySitemap,
  sitemap,
}: {
  mySitemap: string;
  sitemap: string;
}) {
  try {
    const [mySitemapData, sitemapData] = await Promise.all([
      getSitemapLinks(mySitemap),
      getSitemapLinks(sitemap),
    ]);

    console.log("Fetching and analyzing my sitemap...");
    const myContent = await extractUrls(mySitemapData);
    console.log("Fetching and analyzing other sitemap...");
    const otherContent = await extractUrls(sitemapData);

    console.log("Finding intersections...");
    const intersections = findIntersections(myContent, otherContent);

    console.log("Intersections found:", intersections.length);
    console.log(JSON.stringify(intersections, null, 2));

    return intersections;
  } catch (error) {
    console.error("Error fetching sitemaps:", error);
    throw error;
  }
}

async function extractUrls(data: Awaited<ReturnType<typeof getSitemapLinks>>) {
  const tmpDir = path.join(process.cwd(), "tmp");
  await fs.mkdir(tmpDir, { recursive: true });

  const results = await Promise.all(
    data.links.map(async (url: string) => {
      const urlHash = crypto.createHash("md5").update(url).digest("hex");
      const htmlFileName = `${urlHash}.html`;
      const jsonFileName = `${urlHash}.json`;
      const htmlPath = path.join(tmpDir, htmlFileName);
      const jsonPath = path.join(tmpDir, jsonFileName);

      // Check if files already exist
      if (
        (await fs
          .access(htmlPath)
          .then(() => true)
          .catch(() => false)) &&
        (await fs
          .access(jsonPath)
          .then(() => true)
          .catch(() => false))
      ) {
        console.log(`Cache hit for ${url}`);
        const cachedContent = await fs.readFile(jsonPath, "utf-8");
        return JSON.parse(cachedContent);
      }

      const html = await getMainContent(url);
      console.log("HTML parsed for ", url);
      await fs.writeFile(htmlPath, html);

      const content = await getContentFromHtml(html, url);
      console.log("Content parsed for ", url);
      await fs.writeFile(jsonPath, JSON.stringify(content, null, 2));

      return content;
    }),
  );

  return results;
}

const getContentFromHtml = async (html: string, url: string) => {
  const $ = cheerio.load(html);
  const content = $("body").text().trim();

  const { object } = await generateObject({
    model: openai("gpt-4o-mini"),
    system:
      "You are a helpful assistant that can parse the main title of the page content and possible keywords for linking based on the content.",
    schema: z.object({
      title: z.string(),
      keywords: z.array(z.string()),
      url: z.string(),
    }),
    prompt: `
        Parse the main title of the page content and possible keywords for linking based on the content.
        Return the title, keywords, and the original URL in a JSON format.
        URL: ${url}
        ${html}
    `,
  });

  return {
    title: object.title,
    keywords: object.keywords,
    url: object.url,
    content: content,
  };
};

const getMainContent = async (url: string): Promise<string> => {
  try {
    const response = await fetch(url);
    const data = await response.text();
    const $ = cheerio.load(data);

    // Select the main content using common tags or classes
    const mainContent = $("main").length
      ? $("main")
      : $("body").children().not("header, footer, nav").first();

    return mainContent.html() || ""; // Return the HTML of the main content
  } catch (error) {
    console.error(`Error fetching content: ${error}`);
    return "";
  }
};

const findIntersections = (myContent: any[], otherContent: any[]) => {
  const intersections = [];

  for (const myItem of myContent) {
    for (const otherItem of otherContent) {
      const commonKeywords = myItem.keywords.filter((keyword: string) =>
        otherItem.keywords.includes(keyword),
      );

      if (commonKeywords.length > 0) {
        const myKeywordPositions = findKeywordPositions(
          myItem.content,
          commonKeywords,
        );
        const otherKeywordPositions = findKeywordPositions(
          otherItem.content,
          commonKeywords,
        );

        intersections.push({
          myUrl: myItem.url,
          myTitle: myItem.title,
          myKeywordPositions,
          otherUrl: otherItem.url,
          otherTitle: otherItem.title,
          otherKeywordPositions,
          commonKeywords,
        });
      }
    }
  }

  return intersections;
};

const findKeywordPositions = (content: string, keywords: string[]) => {
  const positions: { [keyword: string]: number[] } = {};

  keywords.forEach((keyword) => {
    const regex = new RegExp(`\\b${keyword}\\b`, "gi");
    let match;
    positions[keyword] = [];
    while ((match = regex.exec(content)) !== null) {
      positions[keyword].push(match.index);
    }
  });

  return positions;
};
