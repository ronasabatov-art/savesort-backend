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
    
    // שכבה 1: Metadata Scraper (ניסיון שליפת מידע גלוי מהדף)
    let title = "";
    let description = "";
    let image = "";
    
    try {
      const response = await axios.get(url, { 
          headers: { 'User-Agent': 'Mozilla/5.0' },
          timeout: 5000 
      });
      const $ = cheerio.load(response.data);

      title = $('meta[property="og:title"]').attr("content") || $("title").text();
      description = $('meta[property="og:description"]').attr("content") || $('meta[name="description"]').attr("content") || "";
      image = $('meta[property="og:image"]').attr("content") || "";
    } catch (e) {
      console.log("Metadata fallback triggered");
    }

    // שכבה 2: AI Classification & Understanding
    // כאן ה-Prompt הופך ל"מערכתי" ומטפל בסיטואציות של חוסר מידע או תוכן מדיה
    const aiResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini", // שימוש במודל חזק יותר שתומך בניתוח מורכב
      messages: [
        { 
          role: "system", 
          content: `You are a high-level Content Extraction Agent for SaveSort. 
          Your job is to analyze the provided link data and return a structured JSON object.
          
          RULES:
          1. Detect the content type (Article, Video, PDF, Social Media post).
          2. If metadata is thin or missing, infer the topic from the URL and available text.
          3. CATEGORY: Identify the most specific niche category (e.g., AI Automation, Vegan Recipes, NBA News). Create a NEW category if needed.
          4. SUMMARY: Provide a 2-sentence summary. If it's a video link, summarize based on the context of the title/description.
          5. If audio transcript or OCR text were provided (future-proof), prioritize them.
          
          Return ONLY JSON:
          {
            "type": "content_type",
            "category": "specific_category",
            "summary": "2_sentence_summary",
            "hashtags": ["tag1", "tag2", "tag3"]
          }`
        },
        { 
          role: "user", 
          content: `Analyze this link: ${url}. 
          Metadata Title: ${title}. 
          Metadata Description: ${description}.` 
        }
      ],
      response_format: { type: "json_object" }
    });

    const aiData = JSON.parse(aiResponse.choices[0].message.content);

    // החזרת התוצאה המלאה ל-Base44
    res.json({
      success: true,
      url,
      title: title || "New Saved Content",
      image: image || "https://via.placeholder.com/300?text=SaveSort", // תמונת ברירת מחדל אם חסר
      type: aiData.type,
      category: aiData.category,
      summary: aiData.summary,
      hashtags: aiData.hashtags
    });

  } catch (error) {
    console.error("Critical Error:", error.message);
    res.status(500).json({ 
      success: false, 
      error: "SaveSort was unable to process this link." 
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`SaveSort Engine Running on port ${PORT}`));
