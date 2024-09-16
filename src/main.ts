import { Command } from "commander";
import start from "./start";

const program = new Command();

program
  .name("cross-link-ai")
  .description(
    "CLI tool to create intelligent linking opportunities from sitemaps using AI",
  )
  .version("0.1.0");

program
  .command("start")
  .description("Start the cross-link analysis")
  .requiredOption("-m, --my <url>", "Your Sitemap URL")
  .requiredOption("-s, --sitemap <url>", "URL to the target sitemap file")
  .option("-f, --my-filter <regex>", "Regex to filter paths for your sitemap")
  .option(
    "-g, --sitemap-filter <regex>",
    "Regex to filter paths for the other sitemap",
  )
  .action(
    async (params: {
      my: string;
      sitemap: string;
      myFilter?: string;
      sitemapFilter?: string;
    }) => {
      await start({
        mySitemap: params.my,
        sitemap: params.sitemap,
        myFilter: params.myFilter,
        sitemapFilter: params.sitemapFilter,
      });
    },
  );

program.parse();
