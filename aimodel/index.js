import express from "express";
import cors from "cors";
import helmet from "helmet";
import { GoogleGenerativeAI } from "@google/generative-ai";

const app = express();

// 1. Security Middlewares
app.use(helmet({
    contentSecurityPolicy: false, // Allows the inline success message to render properly
}));
app.use(express.json({ limit: '10mb' }));

// 2. Production & Development CORS Policy
const allowedOrigins = [
    'https://stegopdf2026.web.app',          // Production Firebase
    'https://stegopdf2026.firebaseapp.com',  // Firebase Alternate
    'http://localhost:3000',                 // Local Backend Port
    'http://localhost:5173',                 // Local Vite Development
    'http://localhost:5500'                  // Local VS Code Live Server
];

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl) 
        // or if the origin is in our allowlist
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.log("CORS Blocked Origin:", origin); // Helps you debug which URL is failing
            callback(new Error('CORS access denied.'));
        }
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true
}));

// 3. ROOT ROUTE: Success Message
app.get("/", (req, res) => {
    res.send(`
        <div style="font-family: 'Inter', sans-serif; text-align: center; padding: 60px 20px; background: #f9fafb; min-height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center;">
            <div style="background: white; padding: 40px; border-radius: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); max-width: 500px;">
                <div style="font-size: 50px; margin-bottom: 20px;">✅</div>
                <h1 style="color: #000; margin-bottom: 10px; font-weight: 800;">AI Model Running</h1>
                <p style="color: #666; font-size: 1.1rem; line-height: 1.6;">The StegoPDF Backend is live, secure, and optimized for Binary Intelligence.</p>
                <div style="width: 60px; height: 4px; background: linear-gradient(90deg, #0099ff, #00ffcc); margin: 25px auto; border-radius: 2px;"></div>
                <p style="font-weight: 500; color: #333;">Visit the official website to use the app:</p>
                <a href="https://stegopdf2026.web.app" 
                   style="display: inline-block; margin-top: 20px; padding: 14px 32px; background: #000; color: white; text-decoration: none; border-radius: 12px; font-weight: 600; transition: transform 0.2s;">
                   Visit StegoPDF Official
                </a>
            </div>
            <p style="margin-top: 30px; color: #999; font-size: 0.9rem;">© 2026 StegoPDF Protocol • Vercel Edge Deployment</p>
        </div>
    `);
});
app.post("/chat", async (req, res) => {
    try {
        const { message, context, apiKey } = req.body;

        if (!message) return res.status(400).json({ reply: "Empty message" });
        if (!apiKey) {
            return res.status(400).json({
                reply: "API key is required. Please provide your Gemini API key in the settings."
            });
        }
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const contents = [
            { text: "You are a helpful assistant. Use **bold** for titles and Markdown for clear structure." }
        ];

        if (Array.isArray(context)) {
            for (const item of context) {
                if (item.startsWith("Image File:")) {
                    const base64Match = item.match(/Base64 Data: (data:image\/[^;]+;base64,[^"]+)/);
                    if (base64Match) {
                        const base64Data = base64Match[1];
                        contents.push({
                            inlineData: {
                                mimeType: base64Data.split(';')[0].split(':')[1],
                                data: base64Data.split(',')[1]
                            }
                        });
                    }
                } else {
                    contents.push({ text: item });
                }
            }
        }
        contents.push({ text: `User: ${message}` });
        const result = await model.generateContent(contents);
        const response = await result.response;
        res.json({ reply: response.text() });

    } catch (err) {
        console.error("🔥 Server Error:", err);
        const errorMessage = err.status === 429
            ? "Rate limit reached. Please wait a minute."
            : "Gemini API error. Please verify your API Key.";
        res.status(500).json({ reply: errorMessage });
    }
});
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`
    🚀 SUCCESS!
    AI Model is running locally.
    URL: http://localhost:${PORT}
    
    Press Ctrl+C to stop the server.
    `);
});
export default app;