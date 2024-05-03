import express from 'express';
import puppeteer from 'puppeteer';

const app = express();
const port = 3000;

app.use(express.json());

app.post('/fetch-product-details', async (req, res) => {
  const url = req.body.url;

  if (!url) {
    return res.status(400).send({ error: 'URL is required' });
  }

  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(url);

    // Get image
    const image = await page.$eval('.imgTagWrapper img', (img) => img.src);

    // Get title
    const title = await page.$eval('#productTitle', (el) =>
      el.innerText.trim()
    );

    // Get price
    const priceWhole = await page.$eval('.a-price-whole', (el) =>
      el.innerText.trim().replace(/\n/g, '')
    );
    const priceFraction = await page.$eval('.a-price-fraction', (el) =>
      el.innerText.trim().replace(/\n/g, '')
    );
    const price = `${priceWhole}${priceFraction}`;

    // Get weight
    const weight = await page.evaluate(() => {
      const rows = Array.from(
        document.querySelectorAll('table.prodDetTable tr')
      );
      for (const row of rows) {
        const header = row.querySelector('th').textContent.trim();
        if (header === 'Item Weight') {
          return row
            .querySelector('td')
            .textContent.trim()
            .match(/[+-]?([0-9]*[.])?[0-9]+/)[0];
        }
      }
      const rows2 = Array.from(
        document.querySelectorAll('#detailBullets_feature_div ul.a-unordered-list')
      );
      for (const row2 of rows2) {
        const header = row2.querySelector('li').textContent.trim();
        if (header.includes('Product Dimensions')) {
          const dimensionText = row2.querySelector('span').textContent.trim();
          const weightIndex = dimensionText.lastIndexOf(';') + 1;
          return dimensionText.substring(weightIndex).match(/[+-]?([0-9]*[.])?[0-9]+/)[0];
        }
      }
      return 'Weight not found';
    });

    await browser.close();

    res.status(200).send({ image, title, price, weight });
  } catch (error) {
    console.log(error);
    res.status(500).send({ error: 'Failed to fetch product details' });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
