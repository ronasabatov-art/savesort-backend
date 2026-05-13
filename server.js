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
    
    // שכבה 1: שליפת מטא-דאטה (הבסיס)
    const response = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const $ = cheerio.load(response.data);
    const title = $('meta[property="og:title"]').attr("content") || $("title").text();
    const description = $('meta[property="og:description"]').attr("content") || "";
    const image = $('meta[property="og:image"]').attr("content") || "";

    // זיהוי אם זה וידאו (בשביל ה-Pipeline העתידי)
    const isVideo = url.includes("youtube.com") || url.includes("tiktok.com") || url.includes("instagram.com/reel");

    // שכבה 2: ניתוח חכם (כאן נכנס ה-Vision והבנת התוכן)
    const aiResponse = await openai.chat.completions.create({
      model: "gpt-4o", // מודל שתומך גם בראייה (Vision)
      messages: [
        { 
          role: "system", 
          content: `You are the SaveSort AI Engine. 
          1. Analyze the title and description.
          2. If an image is provided, analyze its visual content (Vision).
          3. If this is a VIDEO, prioritize explaining the action or tutorial described.
          4. Return JSON: { "summary": "...", "category": "...", "hashtags": [...], "type": "..." }`
        },
        { 
          role: "user", 
          content: [
            { type: "text", text: `Analyze this ${isVideo ? 'video' : 'page'}: ${title}. Description: ${description}` },
            { type: "image_url", image_url: { "url": image } } // כאן נכנס ה-Vision!
          ]
        }
      ],
      response_format: { type: "json_object" }
    });

    const aiData = JSON.parse(aiResponse.choices[0].message.content);

    res.json({
      title,
      image,
      url,
      summary: aiData.summary,
      category: aiData.category,
      hashtags: aiData.hashtags,
      type: aiData.type
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`SaveSort AI is live on port ${PORT}`));
