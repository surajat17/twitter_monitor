
const express = require('express');
const puppeteer = require('puppeteer');
const mongoose = require('mongoose');
const cron = require('node-cron');
const path = require('path');

const app = express();

// Define the Tweet schema
const tweetSchema = new mongoose.Schema({
  text: String,
  time: Date,
  username: String,
});

// Create the Tweet model
const Tweet = mongoose.model('Tweet', tweetSchema);

// Connect to MongoDB
mongoose.set('strictQuery', false);

mongoose.connect('mongodb://localhost:27017/tweets', { useNewUrlParser: true });

// Define a function to get recent tweets for a given username
async function getRecentTweets(username) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(`https://twitter.com/${username}`, { timeout: 100000 });
  await page.waitForSelector('article');

  const tweets = await page.evaluate((username) => {
    const articles = Array.from(document.querySelectorAll('article'));
    return articles.map((article) => {
      const tweet = {};
      const textElement = article.querySelector('[data-testid="tweet"] [lang]');
      tweet.text = textElement ? textElement.innerText : '';
      const timeElement = article.querySelector('time');
      tweet.time = timeElement ? timeElement.getAttribute('datetime') : '';
      tweet.username = username;
      return tweet;
    });
  }, username);

  await browser.close();

  return tweets;
}


// Define a route to get the latest tweets for all users
app.get('/tweets', async (req, res) => {
  try {
    const usernames = ['BeosinAlert', 'BlockSecTeam', 'AnciliaInc', 'peckshield', 'CertiKAlert'];
    const tweets = [];
    for (const username of usernames) {
      const recentTweets = await getRecentTweets(username);
      for (const tweet of recentTweets) {
        tweets.push(tweet);
        await Tweet.create(tweet); // Save the tweet to the database
      }
    }
    res.json(tweets);
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

// Define a route to render the tweets in an EJS template
app.get('/', async (req, res) => {
  try {
    const tweets = await Tweet.find();
    res.render('index.ejs', { tweets });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

// Schedule a job to fetch the latest tweets every 10 minutes
cron.schedule('*/5 * * * *', async () => {
  try {
    const usernames = ['BeosinAlert', 'BlockSecTeam', 'AnciliaInc', 'peckshield', 'CertiKAlert'];
    for (const username of usernames) {
      const recentTweets = await getRecentTweets(username);
      for (const tweet of recentTweets) {
        console.log(tweet);
        await Tweet.create(tweet); // Save the tweet to the database
      }
    }
  } catch (error) {
    console.error(error);
  }
});

// Configure EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Start the server
app.listen(3000, () => {
  console.log('Server listening on port 3000');
}); 
