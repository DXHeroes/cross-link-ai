import { Command } from "commander";
import start from "./start";

const program = new Command();

program
  .name("linking-opportunities")
  .description("CLI tool to create linking opportunities from sitemaps")
  .version("0.1.0");

program
  .command("start")
  .description("Start the linking opportunities process")
  .requiredOption("-m, --my <url>", "Your Sitemap URL")
  .requiredOption("-s, --sitemap <url>", "URL to the sitemap file")
  .action(async (params: { my: string; sitemap: string }) => {
    await start({ mySitemap: params.my, sitemap: params.sitemap });
  });

program.parse();
