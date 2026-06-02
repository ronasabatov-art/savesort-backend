const express = require("express");
const cors = require("cors");
const axios = require("axios");
const cheerio = require("cheerio");
const OpenAI = require("openai");
const { exec } = require("child_process");
const util = require("util");
const fs = require("fs");

const execPromise = util.promisify(exec);

const app = express();
app.use(cors());
app.use(express.json());

// OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function getMetadataWithYtDlp(url) {
  try {
    const { stdout } = await execPromise(
      `yt-dlp --dump-json --no-playlist "${url}"`
    );

    const data = JSON.parse(stdout);

    return {
      title: data.title || data.alt_title || "",
      description: data.description || "",
      image: data.thumbnail || ""
    };
  } catch (error) {
    console.log("yt-dlp failed, moving to traditional scraping.");
    return null;
  }
}

// ======================
// Existing Endpoint
// ======================

app.post("/analyze-link", async (req, res) => {
  const { url } = req.body;

  let metadata = {
    title: url,
    description: "",
    image: ""
  };

  try {
    const isVideo =
      url.includes("youtube.com") ||
      url.includes("youtu.be") ||
      url.includes("tiktok.com") ||
      url.includes("instagram.com");

    const extracted = await getMetadataWithYtDlp(url);

    if (extracted) {
      metadata = extracted;
    } else {
      try {
        const response = await axios.get(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
          },
          timeout: 6000
        });

        const $ = cheerio.load(response.data);

        metadata.title =
          $('meta[property="og:title"]').attr("content") ||
          $("title").text() ||
          url;

        metadata.description =
          $('meta[property="og:description"]').attr("content") || "";

        metadata.image =
          $('meta[property="og:image"]').attr("content") || "";
      } catch (e) {
        console.log("Axios scraping failed.");
      }
    }

    const aiResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are the SaveSort AI Engine. Look at the URL and Title to provide a clear name.
Return JSON:
{
  "title": "...",
  "summary": "...",
  "category": "...",
  "tags": [...],
  "type": "..."
}`
        },
        {
          role: "user",
          content: `Link: ${url}. Title: ${metadata.title}. Desc: ${metadata.description}`
        }
      ],
      response_format: {
        type: "json_object"
      }
    });

    const aiData = JSON.parse(
      aiResponse.choices[0].message.content
    );

    res.json({
      title: aiData.title || metadata.title,
      image: metadata.image,
      url,
      summary: aiData.summary,
      category: aiData.category,
      tags: aiData.tags || [],
      type: aiData.type || (isVideo ? "video" : "article")
    });

  } catch (error) {
    console.error("Critical Error:", error.message);

    res.status(500).json({
      error: "Internal Error"
    });
  }
});

// ======================
// NEW VIDEO TRANSCRIPTION ENDPOINT
// ======================

app.post("/download-video", async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        error: "Missing url"
      });
    }

    // קבלת מטא-דאטה
    const { stdout } = await execPromise(
      `yt-dlp --dump-json --no-playlist "${url}"`
    );

    const metadata = JSON.parse(stdout);

    // הורדת הווידאו
    await execPromise(
      `yt-dlp -o "/tmp/video.%(ext)s" "${url}"`
    );

    const files = fs.readdirSync("/tmp");

    const videoFile = files.find(
      file =>
        file.startsWith("video.") &&
        !file.endsWith(".mp3")
    );

    if (!videoFile) {
      throw new Error("Video file not found");
    }

    const videoPath = `/tmp/${videoFile}`;
    const audioPath = "/tmp/audio.mp3";

    // חילוץ אודיו
    await execPromise(
      `ffmpeg -i "${videoPath}" -vn -acodec libmp3lame "${audioPath}" -y`
    );

    // תמלול
    const transcriptResponse =
      await openai.audio.transcriptions.create({
        file: fs.createReadStream(audioPath),
        model: "whisper-1"
      });

    // ניקוי קבצים זמניים
    try {
      if (fs.existsSync(videoPath)) {
        fs.unlinkSync(videoPath);
      }

      if (fs.existsSync(audioPath)) {
        fs.unlinkSync(audioPath);
      }
    } catch (cleanupError) {
      console.log("Cleanup skipped");
    }

    return res.json({
      transcript: transcriptResponse.text,
      video_title: metadata.title || "",
      duration_seconds: metadata.duration || 0
    });

  } catch (error) {
    console.error("Download Video Error:", error);

    return res.status(500).json({
      error: error.message
    });
  }
});

// ======================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
