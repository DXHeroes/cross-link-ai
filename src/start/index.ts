import { generateObject } from "ai";
import getSitemapLinks from "./sitemap";
import * as cheerio from "cheerio";
import { z } from "zod";
import { openai } from "@ai-sdk/openai";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

function filterUrls(urls: string[], filter?: string): string[] {
  if (!filter) return urls;
  const regex = new RegExp(filter);
  return urls.filter((url) => {
    const path = new URL(url).pathname;
    return regex.test(path);
  });
}

export default async function start({
  mySitemap,
  sitemap,
  myFilter,
  sitemapFilter,
}: {
  mySitemap: string;
  sitemap: string;
  myFilter?: string;
  sitemapFilter?: string;
}) {
  try {
    const [mySitemapData, sitemapData] = await Promise.all([
      getSitemapLinks(mySitemap),
      getSitemapLinks(sitemap),
    ]);

    mySitemapData.links = filterUrls(mySitemapData.links, myFilter);
    sitemapData.links = filterUrls(sitemapData.links, sitemapFilter);

    console.log("Fetching and analyzing my sitemap...");
    const myContent = await extractUrls(mySitemapData);
    console.log("Fetching and analyzing other sitemap...");
    const otherContent = await extractUrls(sitemapData);

    console.log("Finding intersections...");
    const intersections = await findIntersections(myContent, otherContent);

    console.log(
      "Sorting intersections by score with the highest score first...",
    );
    const sortedIntersections = intersections.sort(
      (a, b) => b.linkScore - a.linkScore,
    );

    console.log("Intersections found:", intersections.length);

    // save the intersections to a CSV file
    await fs.writeFile(
      path.join(process.cwd(), "./intersections.csv"),
      sortedIntersections
        .map(
          (intersection) =>
            `${intersection.linkFrom},${intersection.linkTo},${intersection.linkText}`,
        )
        .join("\n"),
    );

    // list all intersections in a table with chalk
    console.table(intersections);

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
      "You are a helpful assistant that can parse the main title of the page content and possible phrases for linking based on the content.",
    schema: z.object({
      title: z.string(),
      keywords: z.array(z.string()),
      content: z.string(),
    }),
    prompt: `
        Parse the main title of the page content and possible keywords for linking based on the content.
        Return:
        - the title of the article or just the h1 on the page, not the title tag from <head>!
        - keywords from the content that are not in the title,
        - the content in plain text, exactly as is in the source HTML but without HTML tags, just the text, without any formatting or line breaks,
        - and the original URL in a JSON format.
        ---
        ${html}
    `,
  });

  return {
    title: object.title,
    keywords: object.keywords,
    url: url,
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

type Content = Awaited<ReturnType<typeof getContentFromHtml>>;

const findIntersections = async (
  myContent: Content[],
  otherContent: Content[],
) => {
  const cacheDir = path.join(process.cwd(), "tmp", "intersections");
  await fs.mkdir(cacheDir, { recursive: true });

  const intersections = [];

  for (const myItem of myContent) {
    for (const otherItem of otherContent) {
      const cacheKey = crypto
        .createHash("md5")
        .update(`${myItem.url}:${otherItem.url}`)
        .digest("hex");
      const cachePath = path.join(cacheDir, `${cacheKey}.json`);

      try {
        // Check if cache exists
        const cachedData = await fs.readFile(cachePath, "utf-8");
        intersections.push(...JSON.parse(cachedData));
        console.log(`Cache hit for ${myItem.url} and ${otherItem.url}`);
      } catch (error) {
        // Cache doesn't exist, compute and store
        const { object } = await generateObject({
          model: openai("gpt-4o-mini"),
          system:
            "You are a SEO expert that can find intersections between two pages based on their content of source page and title of target page.",
          schema: z.object({
            intersections: z.array(
              z.object({
                linkFrom: z.string(),
                linkFromText: z.string(),
                linkTo: z.string(),
                linkToReason: z.string(),
                linkScore: z.number(),
              }),
            ),
          }),
          prompt: `
            Find intersections between two pages based on a content of "From content" and title of "To title".
            Return the intersections in an array of objects with the following fields.
            The JSON should be an array of objects with the following fields:
            - linkFrom: the URL of the page that will contain the link
            - linkFromText: the text of the link on the page from which the link is coming, from "From content", 
              the text must be in the content of the page and fit the title "To title" of the page, 
              not in the content of the page "To content". Use the "To content" only to understand the context of the page.
              You MUST be sure that the linkFromText exists in "From content" and navigates to a page that contains the title "To title" that gives an explanation for the LinkFromText.
            - linkTo: the URL of the page that is linked to
            - linkToReason: the reason why the link is going to the page, explain in a short sentence. The reason must be exact and only based on the title "To title" of the page.
            - linkScore: the score of the link, from 0 to 100, based on the similarity of the content "From content" and title "To title" of the two pages and the relevance of the link text. Be very critical in scoring the link and be sure that the link is relevant and makes sense.
              The score should be based on the similarity of the content "From content" and title "To title" of the two pages and the relevance of the link text.
              If the link is not relevant or makes no sense, the score should be 0. If the LinkFromText is not exactly the same as the title "To title", the score should be very low, definitely less than 40.
            ---
            From URL: ${myItem.url}
            From title: ${myItem.title}
            From content: ${myItem.content}
            To URL: ${otherItem.url}
            To title: ${otherItem.title}
            To content: ${otherItem.content}
          `,
        });

        // check that the linkFromText exists in "My content" otherwise remove the intersection
        object.intersections.forEach((intersection) => {
          if (!myItem.content.includes(intersection.linkFromText)) {
            console.log(
              `Link from text not found in "My content" for ${myItem.url} and ${otherItem.url}`,
            );
            const index = object.intersections.findIndex(
              (i) => i.linkFromText === intersection.linkFromText,
            );
            object.intersections.splice(index, 1);
          }
        });

        // filter out the intersections with score less than 60
        object.intersections = object.intersections.filter(
          (i) => i.linkScore >= 50,
        );

        intersections.push(...object.intersections);

        // Cache the result
        await fs.writeFile(cachePath, JSON.stringify(object.intersections));
        console.log(`Cached result for ${myItem.url} and ${otherItem.url}`);
      }
    }
  }

  return intersections;
};
