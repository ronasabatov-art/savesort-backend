const express = require("express");
const cors = require("cors");
const axios = require("axios");
const cheerio = require("cheerio");
const OpenAI = require("openai");

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post("/analyze-link", async (req, res) => {
  try {
    const { url } = req.body;
    
    // ניסיון ראשון: שליפת מטא-דאטה סטנדרטי
    const response = await axios.get(url, { 
        headers: { 'User-Agent': 'Mozilla/5.0' } 
    });
    const $ = cheerio.load(response.data);

    const title = $('meta[property="og:title"]').attr("content") || $("title").text();
    const description = $('meta[property="og:description"]').attr("content") || "";
    const image = $('meta[property="og:image"]').attr("content") || "";

    // שליחה ל-OpenAI לניתוח וסיכום
    const aiResponse = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ 
        role: "system", 
        content: "You are a content analyzer. Summarize the following content in 2 concise sentences and provide 3 relevant hashtags." 
      }, { 
        role: "user", 
        content: `Title: ${title}. Description: ${description}` 
      }],
    });

    res.json({
      title,
      summary: aiResponse.choices[0].message.content,
      image,
      url
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to analyze link: " + error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
