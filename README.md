# Linking Opportunities Finder using AI

This project is a CLI tool designed to find linking opportunities between websites using AI-powered content analysis.

## Features

- Fetch and parse sitemaps
- Extract main content from web pages
- Analyze content using AI to identify keywords and titles
  - Uses `gpt-4o-mini` model from `ai` Vercel SDK
- Compare content across different websites to find linking opportunities

## Prerequisites

- Node.js (v20.15.0 or later)
- yarn or npm

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/dxheroes/linking-opportunities
   cd linking-opportunities
   ```

2. Install dependencies:
   ```
   yarn install
   # or
   npm install
   ```

3. Create `.env` file with `OPENAI_API_KEY`. See `.env.example` for more info.

## Usage

To start the linking opportunities process, use the following command:
```
yarn start -- start -m [your-sitemap-url] -s [target-sitemap-url]
# or
npm start -- start -m [your-sitemap-url] -s [target-sitemap-url]
```

### Example

```bash
yarn start -- start -m https://dxheroes.io/sitemap.xml --my-filter "/blog/" -s https://developerexperience.io/sitemap.xml --sitemap-filter "articles/"
```

Replace `[your-sitemap-url]` with the URL of your sitemap and `[target-sitemap-url]` with the URL of the sitemap you want to compare against.

### Options

```bash
Usage: linking-opportunities start [options]

Start the linking opportunities process

Options:
  -m, --my <url>                Your Sitemap URL
  -s, --sitemap <url>           URL to the target sitemap file
  -f, --my-filter <regex>       Regex to filter paths for your sitemap
  -g, --sitemap-filter <regex>  Regex to filter paths for the other sitemap
  -h, --help                    display help for command
```

## Scripts

- `yarn start`: Run the application
- `yarn build`: Build the project using webpack
- `yarn dev`: Run the application in watch mode
- `yarn test:watch`: Run tests in watch mode
- `yarn format`: Format code using Prettier

## Project Structure

- `src/`: Source code
  - `main.ts`: Entry point of the application
  - `start/`: Main logic for the linking opportunities process
  - `helper.ts`: Utility functions

## Dependencies

Key dependencies include:

- `@ai-sdk/anthropic` and `@ai-sdk/openai`: AI SDKs for content analysis
- `cheerio`: HTML parsing
- `commander`: CLI interface
- `sitemap-links-ts`: Sitemap parsing
- `zod`: Schema validation

For a full list of dependencies, refer to the `package.json` file.

## Development

1. Make sure you're using the correct Node.js version:
   ```
   nvm use
   ```

2. Start the development server:
   ```
   yarn dev
   # or
   npm run dev
   ```


3. Format code before committing:
   ```
   yarn format
   # or
   npm run format
   ```

## Building

To build the project for production:
```
yarn build
# or
npm run build
```

The output will be in the `dist/` directory.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some Amazing Feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.

## Author

Prokop Simek <prokop.simek@dxheroes.io>