import { parseStringPromise } from "xml2js";

type SitemapURLSet = {
  url: SitemapURL | SitemapURL[];
};

type SitemapURL = {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: string;
};

const fetchSitemap = async (
  originalUrl: string,
  timeout = 60000,
): Promise<any> => {
  const controller = new AbortController();
  const signal = controller.signal;

  const url = new URL(
    originalUrl.startsWith("http") ? originalUrl : `https://${originalUrl}`,
  );

  setTimeout(() => {
    controller.abort();
  }, timeout);

  try {
    const res = await fetch(url, { signal });
    const xml = await res.text();
    const { sitemapindex, urlset } = (await parseStringPromise(xml)) as {
      sitemapindex?: { sitemap: SitemapURL | SitemapURL[] };
      urlset?: SitemapURLSet;
    };

    // sitemap contains URLs directly, return them
    if (urlset) {
      return "loc" in urlset.url
        ? urlset.url // Only single URL in sitemap
        : urlset.url.map((link) => link); // Multiple URLs in sitemap
    }

    // Sitemap contains URLs to other sitemap(s), download them recursively
    if (sitemapindex) {
      if ("loc" in sitemapindex.sitemap) {
        return await Promise.all([fetchSitemap(sitemapindex.sitemap.loc)]);
      }

      return await Promise.all(
        sitemapindex.sitemap.map((sitemap) => fetchSitemap(sitemap.loc)),
      );
    }

    // Something else, return empty array
    return [];
  } catch (e) {
    console.error(e);
  }
};

const getSitemapLinks = async (url: string, timeout = 60000) => {
  try {
    // Fetch sitemap recursively
    let links = await fetchSitemap(url, timeout);

    // Flattern array
    links = links.flat(Infinity);

    // Get only unique links
    const uniqueLinks = links.filter(
      (link: SitemapURL, index: number, self: SitemapURL[]) => {
        return self.findIndex((l) => l.loc === link.loc) === index;
      },
    );

    return {
      links: uniqueLinks.map((link: SitemapURL) => link.loc).flat(),
      data: uniqueLinks,
      count: uniqueLinks.length,
      url,
    };
  } catch (e) {
    throw new Error(`Unable to fetch sitemap. ${e}`);
  }
};

export default getSitemapLinks;
