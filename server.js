const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const helmet = require('helmet'); // helmet morgan body-parser mongoose
const morgan = require('morgan');
const puppeteer = require('puppeteer');

// adding Helmet to enhance your API's security
app.use(helmet());

// Redirect HTTP to HTTPS
app.use((req, res, next) => {
  if (!req.secure) {
    next();
  } else {
    res.redirect(301, 'http://' + req.headers.host + req.url);
  }
});


// enabling CORS for all requests
app.use(cors());

// adding morgan to log HTTP requests
app.use(morgan('combined'));

app.use(express.json());
//
//to send data from post man and any front end
app.use(bodyParser.json({ limit: "200mb" }));
app.use(bodyParser.urlencoded({ limit: "200mb", extended: true, parameterLimit: 1000000 }));

// public place for img
app.use('/uploads', express.static('uploads'));

// parse an HTML body into a string
app.use(bodyParser.json());


// Middleware
app.use(bodyParser.json());


app.post('/fetch-product-details', async (req, res) => {
  const url = req.body.url;

  if (!url) {
    return res.status(400).send({ error: 'URL is required' });
  }

  try {
    const browser = await puppeteer.launch({headless:true});
    const page = await browser.newPage();
    await page.goto(url);
    // await page.screenshot({ path: 'screenshot.png' });

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

    
    const amazonShipping = await page.evaluate(() => {
      const shippingElements = document.querySelectorAll('table.a-lineitem tr');
      for (const element of shippingElements) {
        const text = element.querySelector('td.a-span9.a-text-left span.a-size-base.a-color-secondary').textContent.trim();
        if (text === 'AmazonGlobal Shipping') {
          const priceElement = element.querySelector('td.a-span2.a-text-right span.a-size-base.a-color-base');
          if (priceElement) {
            return priceElement.textContent.trim().replace(/\$/g, '');
          }
        }
      }
      return null;
    });
    
    const importCharges = await page.evaluate(() => {
      const chargesElements = document.querySelectorAll('table.a-lineitem tr');
      for (const element of chargesElements) {
        const text = element.querySelector('td.a-span9.a-text-left span.a-size-base.a-color-secondary').textContent.trim();
        if (text === 'Estimated Import Charges') {
          const chargesPriceElement = element.querySelector('td.a-span2.a-text-right span.a-size-base.a-color-base');
          if (chargesPriceElement) {
            return chargesPriceElement.textContent.trim().replace(/\$/g, '');
          }
        }
      }
      return null;
    });

    await browser.close();

    res.status(200).send({ image, title, price, weight,amazonShipping:amazonShipping??0 ,importCharges:importCharges??0});
  } catch (error) {
    console.log(error);
    // res.status(200).send(error);
    res.status(500).send({ error: 'Failed to fetch product details' });
  }
});



// Start the server
const PORT = process.env.PORT || 3003;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
