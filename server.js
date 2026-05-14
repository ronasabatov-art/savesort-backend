const express = require("express");
const cors = require("cors");
const axios = require("axios");
const cheerio = require("cheerio");
const OpenAI = require("openai");
const { exec } = require("child_process");
const util = require("util");
const execPromise = util.promisify(exec);

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// פונקציה לחילוץ Metadata בעזרת yt-dlp - עוקף חסימות של אינסטגרם ויוטיוב
async function getMetadataWithYtDlp(url) {
  try {
    // הרצת הפקודה שמחזירה JSON עם כל פרטי הסרטון/פוסט
    // הנתיב /venv/bin/yt-dlp מותאם להגדרות ה-Dockerfile
    const { stdout } = await execPromise(`/venv/bin/yt-dlp --dump-json --no-playlist "${url}"`);
    const data = JSON.parse(stdout);
    return {
      title: data.title || data.alt_title || "Video content",
      description: data.description || "",
      image: data.thumbnail || ""
    };
  } catch (error) {
    console.log("yt-dlp failed or link is not a video, falling back to traditional scraping.");
    return null;
  }
}

app.post("/analyze-link", async (req, res) => {
  const { url } = req.body;
  let metadata = { title: url, description: "", image: "" };

  try {
    const isVideo = url.includes("youtube.com") || url.includes("youtu.be") || 
                    url.includes("tiktok.com") || url.includes("instagram.com");

    let extracted = null;
    
    // ניסיון ראשון: חילוץ מקצועי לסרטונים
    if (isVideo) {
      extracted = await getMetadataWithYtDlp(url);
    }

    if (extracted) {
      metadata = extracted;
    } else {
      // גיבוי: סריקה רגילה לאתרים אחרים
      try {
        const response = await axios.get(url, { 
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          timeout: 7000 
        });
        const $ = cheerio.load(response.data);
        metadata.title = $('meta[property="og:title"]').attr("content") || $("title").text() || url;
        metadata.description = $('meta[property="og:description"]').attr("content") || $('meta[name="description"]').attr("content") || "";
        metadata.image = $('meta[property="og:image"]').attr("content") || "";
      } catch (e) {
        console.log("Traditional scraping failed.");
      }
    }

    // ניתוח המידע בעזרת ה-AI של SaveSort
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
          content: `Analyze this link: ${url}. Title: ${metadata.title}. Description: ${metadata.description}`
        }
      ],
      response_format: { type: "json_object" }
    });

    const aiData = JSON.parse(aiResponse.choices[0].message.content);

    // החזרת המידע המובנה ל-Base44
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
    console.error("Analysis Error:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`SaveSort AI Server live on port ${PORT}`));
