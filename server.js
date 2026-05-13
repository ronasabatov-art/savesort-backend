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
  const { url } = req.body;
  let metadata = { title: url, description: "", image: "" };

  try {
    // שלב 1: ניסיון סריקה (Scraping) עם הגנה מפני קריסה
    try {
      const response = await axios.get(url, { 
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' 
        },
        timeout: 5000 
      });

      const $ = cheerio.load(response.data);
      metadata.title = $('meta[property="og:title"]').attr("content") || $("title").text() || url;
      metadata.description = $('meta[property="og:description"]').attr("content") || "";
      metadata.image = $('meta[property="og:image"]').attr("content") || "";
    } catch (scrapingError) {
      // אם הסריקה נכשלה (למשל אינסטגרם חסמה), אנחנו לא קורסים! פשוט ממשיכים עם ה-URL
      console.log("Scraping blocked or failed, proceeding with URL only.");
    }

    const isVideo = url.includes("youtube.com") || url.includes("tiktok.com") || url.includes("instagram.com/reel");

    // שלב 2: ניתוח ה-AI (תמיד ירוץ, גם אם הסריקה נכשלה)
    const aiResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { 
          role: "system", 
          content: `You are the SaveSort AI Engine. 
          Analyze the provided link and metadata. 
          If metadata is missing, rely on the URL structure.
          Return JSON: { "summary": "...", "category": "...", "hashtags": [...], "type": "..." }` 
        },
        { 
          role: "user", 
          content: [
            { type: "text", text: `Analyze this ${isVideo ? 'video' : 'page'}: ${url}. Metadata Title: ${metadata.title}. Description: ${metadata.description}` },
            { type: "image_url", image_url: { "url": metadata.image || "https://placehold.co/600x400?text=No+Preview" } }
          ]
        }
      ],
      response_format: { type: "json_object" }
    });

    const aiData = JSON.parse(aiResponse.choices[0].message.content);

    // החזרת התשובה ל-Base44
    res.json({
      title: metadata.title,
      image: metadata.image,
      url,
      summary: aiData.summary,
      category: aiData.category,
      hashtags: aiData.hashtags,
      type: aiData.type
    });

  } catch (error) {
    console.error("Critical Error:", error.message);
    res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`SaveSort AI is live on port ${PORT}`));
