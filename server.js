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
    try {
      const response = await axios.get(url, { 
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7'
        },
        timeout: 8000 
      });

      const $ = cheerio.load(response.data);
      metadata.title = $('meta[property="og:title"]').attr("content") || $("title").text() || url;
      metadata.description = $('meta[property="og:description"]').attr("content") || $('meta[name="description"]').attr("content") || "";
      metadata.image = $('meta[property="og:image"]').attr("content") || "";
    } catch (scrapingError) {
      console.log("Scraping failed, AI will analyze URL structure.");
    }

    const isVideo = url.includes("youtube.com") || url.includes("tiktok.com") || url.includes("instagram.com/reel");

    const aiResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { 
          role: "system", 
          content: `You are the SaveSort AI Engine. 
          Extract meaning from the URL and metadata. 
          CRITICAL: Return 'tags' as an array of strings.
          Return JSON: { "summary": "...", "category": "...", "tags": [...], "type": "..." }` 
        },
        { 
          role: "user", 
          content: `Analyze: ${url}. Title: ${metadata.title}. Desc: ${metadata.description}`
        }
      ],
      response_format: { type: "json_object" }
    });

    const aiData = JSON.parse(aiResponse.choices[0].message.content);

    // מחזירים tags במקום hashtags כדי להתאים ל-Base44
    res.json({
      title: metadata.title,
      image: metadata.image,
      url,
      summary: aiData.summary,
      category: aiData.category,
      tags: aiData.tags || [], 
      type: aiData.type || (isVideo ? "video" : "article")
    });

  } catch (error) {
    console.error("Critical Error:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`SaveSort AI is live on port ${PORT}`));
