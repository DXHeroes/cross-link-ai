import { parseStringPromise } from "xml2js";

export default async function start({
  mySitemap,
  sitemap,
}: {
  mySitemap: string;
  sitemap: string;
}) {
  try {
    const [mySitemapData, sitemapData] = await Promise.all([
      fetchSitemapData(mySitemap),
      fetchSitemapData(sitemap),
    ]);

    const myTitles = extractTitles(mySitemapData);
    const otherTitles = extractTitles(sitemapData);

    const linkingOpportunities = myTitles.filter((title) =>
      otherTitles.includes(title),
    );

    console.log("Linking Opportunities:", linkingOpportunities);
  } catch (error) {
    console.error("Error fetching sitemaps:", error);
  }
}

async function fetchSitemapData(url: string) {
  const serializedUrl = new URL(
    url.startsWith("http") ? url : `https://${url}`,
  );
  console.log("serializedUrl", serializedUrl);
  const response = await fetch(serializedUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.statusText}`);
  }
  const data = await response.text();
  return parseStringPromise(data);
}

function extractTitles(sitemapData: any) {
  const titles: string[] = [];
  const urls = sitemapData.urlset.url || [];
  urls.forEach((url: any) => {
    if (url.title) {
      titles.push(url.title[0]);
    }
  });
  return titles;
}
