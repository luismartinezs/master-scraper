const fs = require('fs');
const slug = require('slug');
const { DateTime } = require('luxon');
const puppeteer = require('puppeteer');

const MAX_WORDS_PER_FILE = 2000;

if (process.argv.length < 3) {
  console.error('Usage: node scrape.js <url>');
  process.exit(1);
}

const url = process.argv[2];

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.goto(url);

  let mainElement = await page.$('main');

  if (!mainElement) {
    console.warn('Warning: "main" element not found on the page. Using "body" element instead.');
    mainElement = await page.$('body');
  }

  const mainText = await mainElement.evaluate((element) => {
    // Remove all <style>, <script>, and <noscript> elements from the main content
    ['style', 'script', 'noscript'].forEach((tag) => {
      Array.from(element.querySelectorAll(tag)).forEach((elem) => {
        elem.remove();
      });
    });

    // Split the text content into lines and filter out unwanted lines
    const lines = element.textContent.split('\n');
    const filteredLines = lines.filter(line => {
      // Check if the line contains an unwanted pattern (e.g., "Advertisement")
      const unwantedPatterns = [/Advertisement/];
      return !unwantedPatterns.some(pattern => pattern.test(line));
    });

    return filteredLines.join('\n');
  });


  const words = mainText.split(/\s+/);

  const slugifiedUrl = slug(url);
  const timestamp = DateTime.now().toFormat('yyyyMMdd-HHmmss');
  const folderName = `output/${slugifiedUrl}/${timestamp}`;
  fs.mkdirSync(folderName, { recursive: true });

  let fileCounter = 1;
  while (words.length > 0) {
    const fileWords = words.splice(0, MAX_WORDS_PER_FILE);
    const fileName = `${folderName}/${slugifiedUrl}-${fileCounter}.txt`;

    fs.writeFileSync(fileName, fileWords.join(' '));
    console.log(`Written ${fileWords.length} words to ${fileName}`);
    fileCounter++;
  }

  await browser.close();
})();
