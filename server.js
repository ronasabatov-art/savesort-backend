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
    
    // שליפת מטא-דאטה מהלינק
    const response = await axios.get(url, { 
        headers: { 'User-Agent': 'Mozilla/5.0' } 
    });
    const $ = cheerio.load(response.data);

    const title = $('meta[property="og:title"]').attr("content") || $("title").text();
    const description = $('meta[property="og:description"]').attr("content") || "";
    const image = $('meta[property="og:image"]').attr("content") || "";

    // פנייה ל-OpenAI לזיהוי קטגוריה דינמית וניתוח התוכן
    const aiResponse = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { 
          role: "system", 
          content: "Analyze the content and return a JSON object. For 'category', identify the most specific and relevant topic (e.g., Gardening, Productivity, AI, Recipes, Marketing). Do not use a pre-defined list—create a new category if it fits. Also provide a 'summary' (2 sentences) and 'hashtags' (array of 3)." 
        },
        { 
          role: "user", 
          content: `Title: ${title}. Description: ${description}` 
        }
      ],
      response_format: { type: "json_object" }
    });

    // פיענוח התשובה מה-AI
    const aiData = JSON.parse(aiResponse.choices[0].message.content);

    // החזרת התשובה המלאה ל-Base44
    res.json({
      title,
      image,
      url,
      summary: aiData.summary,
      category: aiData.category,
      hashtags: aiData.hashtags
    });

  } catch (error) {
    console.error("Analysis error:", error.message);
    res.status(500).json({ error: "Failed to analyze link: " + error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
