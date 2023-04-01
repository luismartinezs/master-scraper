const fs = require('fs');
const slug = require('slug');
const { DateTime } = require('luxon');
const puppeteer = require('puppeteer');

const MAX_WORDS_PER_FILE = 2000;

function validateArguments() {
  if (process.argv.length < 3) {
    console.error('Usage: node scrape.js <url>');
    process.exit(1);
  }
}

async function getMainElement(page) {
  let mainElement = await page.$('main');

  if (!mainElement) {
    console.warn('Warning: "main" element not found on the page. Using "body" element instead.');
    return page.$('body');
  }
  return mainElement;
}

async function cleanElement(element) {
  // Remove all <style>, <script>, and <noscript> elements from the main content
  ['style', 'script', 'noscript'].forEach((tag) => {
    Array.from(element.querySelectorAll(tag)).forEach((elem) => {
      elem.remove();
    });
  });

  // Filter out <header>, <footer>, and <aside> elements if they are direct children of the <body> element
  if (element.tagName.toLowerCase() === 'body') {
    ['header', 'footer', 'aside'].forEach((tag) => {
      Array.from(element.children).forEach((child) => {
        if (child.tagName.toLowerCase() === tag) {
          child.remove();
        }
      });
    });
  }

  // Split the text content into lines and filter out unwanted lines
  const lines = element.textContent.split('\n');
  const filteredLines = lines.filter(line => {
    // Check if the line contains an unwanted pattern (e.g., "Advertisement")
    const unwantedPatterns = [/Advertisement/];
    return !unwantedPatterns.some(pattern => pattern.test(line));
  });

  const cleanedLines = filteredLines.map(line => line.trim().replace(/\s{2,}/g, ' ')).filter(line => line.match(/\w/))
  return cleanedLines;
}

async function saveWordsToFiles(words, folderName, slugifiedUrl) {
  let fileCounter = 1;
  while (words.length > 0) {
    const fileWords = words.splice(0, MAX_WORDS_PER_FILE);
    const fileName = `${folderName}/${slugifiedUrl}-${fileCounter}.txt`;

    fs.writeFileSync(fileName, fileWords.join(' '));
    console.log(`Written ${fileWords.length} words to ${fileName}`);
    fileCounter++;
  }
}

const url = process.argv[2];

(async () => {
  validateArguments()

  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.goto(url);

  const mainElement = await getMainElement(page)
  const cleanedLines = await mainElement.evaluate(cleanElement);

  let joinedText = cleanedLines.join('. ');
  joinedText = joinedText.replace(/(\. ){2,}/g, '. ');

  const words = joinedText.split(/\s+/);

  const slugifiedUrl = slug(url);
  const timestamp = DateTime.now().toFormat('yyyyMMdd-HHmmss');
  const folderName = `output/${slugifiedUrl}/${timestamp}`;

  fs.mkdirSync(folderName, { recursive: true });
  await saveWordsToFiles(words, folderName, slugifiedUrl);
  await browser.close();
})();
