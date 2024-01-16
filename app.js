const express = require('express');
const bodyParser = require('body-parser');
const natural = require('natural');
const path = require('path');
const mongoose = require('mongoose');
const multer = require('multer');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

const tokenizer = new natural.SentenceTokenizer();
const wordTokenizer = new natural.WordTokenizer();
const stopWords = new Set(natural.stopwords.words);

function summarizeText(inputText, numSentences = 5) {
  // Tokenize the input text into sentences
  const sentences = tokenizer.tokenize(inputText);

  // Tokenize each sentence into words
  const words = sentences.flatMap(sentence =>
      wordTokenizer.tokenize(sentence.toLowerCase())
  );

  // Remove stopwords (common words that don't carry much meaning)
  const filteredWords = words.filter(word => word.match(/[a-zA-Z0-9]/) && !stopWords.has(word));

  // Calculate word frequency
  const wordFreq = {};
  filteredWords.forEach(word => {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
  });

  // Assign importance scores to sentences based on word frequency
  const sentenceScores = {};
  sentences.forEach((sentence, i) => {
      const sentenceWords = wordTokenizer.tokenize(sentence);
      sentenceWords.forEach(word => {
          if (wordFreq[word]) {
              sentenceScores[i] = (sentenceScores[i] || 0) + wordFreq[word];
          }
      });
  });

  // Select the top 'numSentences' sentences with the highest scores
  const selectedSentences = Object.keys(sentenceScores)
      .sort((a, b) => sentenceScores[b] - sentenceScores[a])
      .slice(0, numSentences);

  // Generate the summarized text
  const summarizedText = selectedSentences
      .map(index => sentences[index])
      .join(' ');

  return summarizedText;
}

// Connect to MongoDB
mongoose.connect('mongodb://mymongodbac:AFExw5Veb5znSY8InRmXN5nhe1kQKWubbf1bVrBWYPa6F50kH8EROgdABn7O44fP3wosnXFDo9ylACDbdagGbA==@mymongodbac.mongo.cosmos.azure.com:10255/?ssl=true&retrywrites=false&replicaSet=globaldb&maxIdleTimeMS=120000&appName=@mymongodbac@', {
  
});

// Define Mongoose schema for image and PDF
const imageSchema = new mongoose.Schema({
  path: String,
  text: String,
  summary: String,
});

const pdfSchema = new mongoose.Schema({
  text: String,
  summary: String,
});

const Image = mongoose.model('Image', imageSchema);
const Pdf = mongoose.model('Pdf', pdfSchema);

// tis is for store an image  on upload folder
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(express.static('public'));

// Serve the HTML page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Handle image upload and summarization
app.post('/summarizeImage', upload.single('fileInput'), async (req, res) => {
  try {
    const imgText = req.body.textimg;
    const imgSummary = req.body.summaryResultimg;
    const imagePath = req.file.path;
    // Save image data to MongoDB
    const image = new Image({
      path: imagePath,
      text: imgText,
      summary: imgSummary,  // Save the binary image data
    });

    await image.save();

    res.send({ message: 'Image data stored successfully' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send({ error: 'Internal Server Error' });
  }
});


// Handle PDF upload and summarization
app.post('/summarizePdf', upload.single('pdfInput'), async (req, res) => {
  try {
    const pdfText = req.body.text;
    const pdfSummary = req.body.summaryResult;

    // Save PDF data to MongoDB
    const pdf = new Pdf({
      text: pdfText,
      summary: pdfSummary,
    });

    await pdf.save();

    res.send({ message: 'PDF data stored successfully' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send({ error: 'Internal Server Error' });
  }
});
app.post('/summarize', (req, res) => {
  try {
    const inputText = req.body.text;
    const summary = summarizeText(inputText);
    res.send({ summary });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send({ error: 'Internal Server Error' });
  }
});

app.get('/history', (req, res) => {
  res.sendFile(path.join(__dirname, 'history.html'));
});

// Fetch image data
app.get('/fetchImageData', async (req, res) => {
  try {
    const imageData = await Image.find();
    res.json(imageData);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send({ error: 'Internal Server Error' });
  }
});

// Fetch PDF data
app.get('/fetchPdfData', async (req, res) => {
  try {
    const pdfData = await Pdf.find();
    res.json(pdfData);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send({ error: 'Internal Server Error' });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
