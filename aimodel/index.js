import "dotenv/config";
import express from "express";
import cors from "cors";
import { GoogleGenerativeAI } from "@google/generative-ai";
import crypto from "crypto";

// Global state for load balancing
let currentKeyIndex = 0;
let apiKeys = [];
let requestCounts = {}; // Per-key request counters for load balancing
if (process.env.GEMINI_API_KEYS) {
    apiKeys = process.env.GEMINI_API_KEYS.split(',').map(key => key.trim()).filter(Boolean);
    if (apiKeys.length === 0) {
        console.warn("⚠️ No valid GEMINI_API_KEYS found in .env");
    } else {
        console.log(`✅ Loaded ${apiKeys.length} Gemini API keys for load balancing`);
    }
} else {
    console.error("❌ GEMINI_API_KEYS not set in .env. Add 2+ keys separated by commas.");
}

const app = express();
const PORT = 3000;

// Least-used key selection for perfect load balancing
function getLeastUsedKey() {
    if (apiKeys.length === 0) return null;

    // Initialize counters if missing
    apiKeys.forEach(key => {
        if (!requestCounts[key]) requestCounts[key] = 0;
    });

    // Find key with minimum requests (tie-break by index)
    let minCount = Infinity;
    let leastUsedKey = null;
    let minIndex = Infinity;

    apiKeys.forEach((key, index) => {
        const count = requestCounts[key] || 0;
        if (count < minCount || (count === minCount && index < minIndex)) {
            minCount = count;
            leastUsedKey = key;
            minIndex = index;
        }
    });

    console.log(`⚖️ Using least-used key #${minIndex + 1}/${apiKeys.length} (requests: ${minCount})`);
    return leastUsedKey;
}

// Keep old rotator as fallback
function getRotatedApiKey() {
    if (apiKeys.length === 0) return null;
    const key = apiKeys[currentKeyIndex];
    currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
    console.log(`🔄 Fallback: Using Gemini key ${currentKeyIndex} of ${apiKeys.length}`);
    return key;
}

// Fallback wrapper for 429 errors
async function callGeminiWithFallback(primaryKey, contents, modelName = "gemini-2.5-flash") {
    const genAI = new GoogleGenerativeAI(primaryKey);
    const model = genAI.getGenerativeModel({ model: modelName });

    try {
        const result = await model.generateContent(contents);
        return await result.response.text();
    } catch (err) {
        console.error(`❌ Key ${primaryKey.slice(0, 10)}... failed (status: ${err.status}):`, err.message);
        if (err.status === 429 && apiKeys.length > 1) {
            console.log("🔄 Retrying with least-used key due to 429...");
            const fallbackKey = getLeastUsedKey();
            if (fallbackKey && fallbackKey !== primaryKey) {
                requestCounts[fallbackKey] = (requestCounts[fallbackKey] || 0) + 1;
                return await callGeminiWithFallback(fallbackKey, contents, modelName);
            }
        }
        throw err; // Re-throw non-429 or no fallback
    }
}

app.use(cors());
app.use(express.json({ limit: '50mb', extended: true })); // Fix PayloadTooLargeError

/* 🔑 Server-side keys power chatbot directly - no client key needed */

/* In-memory user storage (for demo purposes - use a database in production) */
const users = new Map();
const sessions = new Map();



// Simple token generation
function generateToken() {
    return crypto.randomBytes(32).toString("hex");
}

// Hash password (simple SHA-256 for demo - use bcrypt in production)
function hashPassword(password) {
    return crypto.createHash("sha256").update(password).digest("hex");
}

// Auth middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({ error: "Authentication required" });
    }

    const session = sessions.get(token);
    if (!session) {
        return res.status(401).json({ error: "Invalid or expired token" });
    }

    req.user = session.user;
    req.token = token;
    next();
}



/* ==================== AUTHENTICATION ENDPOINTS ==================== */

// Sign Up
app.post("/auth/signup", async (req, res) => {
    try {
        const { email, password, name } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: "Email and password are required" });
        }

        // Check if user already exists
        const existingUser = Array.from(users.values()).find(
            (u) => u.email.toLowerCase() === email.toLowerCase()
        );

        if (existingUser) {
            return res.status(400).json({ error: "User already exists" });
        }

        // Create new user
        const userId = crypto.randomUUID();
        const user = {
            id: userId,
            email: email.toLowerCase(),
            password: hashPassword(password),
            name: name || email.split("@")[0],
            createdAt: new Date().toISOString(),
        };

        users.set(userId, user);

        // Generate session token
        const token = generateToken();
        sessions.set(token, {
            user: { id: userId, email: user.email, name: user.name },
            createdAt: new Date().toISOString(),
        });

        res.status(201).json({
            message: "Account created successfully",
            token,
            user: { id: userId, email: user.email, name: user.name },
        });
    } catch (error) {
        console.error("Signup error:", error);
        res.status(500).json({ error: "Failed to create account" });
    }
});

// Sign In
app.post("/auth/signin", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: "Email and password are required" });
        }

        // Find user by email
        const user = Array.from(users.values()).find(
            (u) => u.email.toLowerCase() === email.toLowerCase()
        );

        if (!user) {
            return res.status(401).json({ error: "Invalid email or password" });
        }

        // Verify password
        const hashedPassword = hashPassword(password);
        if (user.password !== hashedPassword) {
            return res.status(401).json({ error: "Invalid email or password" });
        }

        // Generate session token
        const token = generateToken();
        sessions.set(token, {
            user: { id: user.id, email: user.email, name: user.name },
            createdAt: new Date().toISOString(),
        });

        res.json({
            message: "Signed in successfully",
            token,
            user: { id: user.id, email: user.email, name: user.name },
        });
    } catch (error) {
        console.error("Signin error:", error);
        res.status(500).json({ error: "Failed to sign in" });
    }
});

// Sign Out
app.post("/auth/signout", authenticateToken, (req, res) => {
    // Remove session
    sessions.delete(req.token);
    res.json({ message: "Signed out successfully" });
});

// Get Current User
app.get("/auth/me", authenticateToken, (req, res) => {
    res.json({ user: req.user });
});

// Check if email exists (for login validation)
app.get("/auth/check-email/:email", (req, res) => {
    const { email } = req.params;
    const user = Array.from(users.values()).find(
        (u) => u.email.toLowerCase() === email.toLowerCase()
    );
    res.json({ exists: !!user });
});

/* ==================== CHATBOT ENDPOINT ==================== */
/* ✅ Powered by server-side Gemini key rotation + 429 fallback */

app.post("/chat", async (req, res) => {
    try {
        const { message, context } = req.body;

        if (!message) {
            return res.status(400).json({ reply: "Empty message" });
        }

        if (apiKeys.length === 0) {
            return res.status(500).json({ reply: "Server not configured with GEMINI_API_KEYS. Check .env" });
        }

        // Get least-used key for equal distribution
        const primaryKey = getLeastUsedKey();
        if (primaryKey) {
            requestCounts[primaryKey] = (requestCounts[primaryKey] || 0) + 1;
        }

        // Build multimodal contents (unchanged)
        const contents = [];

        // Add system prompt
        contents.push({ text: "You are a helpful assistant. Always structure your responses with clear formatting: Use **bold** for titles and important headings, add line breaks for paragraphs, use bullet points or numbered lists where appropriate, and ensure proper spacing for readability. Format your response in Markdown for better structure." });

        // Process context
        if (Array.isArray(context)) {
            for (const item of context) {
                if (item.startsWith("Image File:")) {
                    // Extract base64 data
                    const base64Match = item.match(/Base64 Data: (data:image\/[^;]+;base64,[^"]+)/);
                    if (base64Match) {
                        const base64Data = base64Match[1];
                        const mimeType = base64Data.split(';')[0].split(':')[1];
                        const data = base64Data.split(',')[1];
                        contents.push({
                            inlineData: {
                                mimeType: mimeType,
                                data: data
                            }
                        });
                    }
                } else {
                    // Add as text
                    contents.push({ text: item });
                }
            }
        }

        // Add user message
        contents.push({ text: `User: ${message}` });

        // Call Gemini with fallback
        const reply = await callGeminiWithFallback(primaryKey, contents);

        res.json({ reply });
    } catch (err) {
        // Enhanced logging
        console.error("🔥 GEMINI ERROR:", err);

        if (err.status === 429) {
            return res.status(429).json({ reply: "Rate limit reached across all keys. Please wait." });
        }

        res.status(500).json({
            reply: `Gemini API error: ${err.message}. Check server logs.`
        });
    }
});

// Stats endpoint for monitoring balance
app.get("/stats", (req, res) => {
    const totalRequests = Object.values(requestCounts).reduce((sum, count) => sum + count, 0);
    const balanced = Math.max(...Object.values(requestCounts)) - Math.min(...Object.values(requestCounts || { 0: 0 })) <= 1;
    res.json({
        apiKeysCount: apiKeys.length,
        requestCounts,
        totalRequests,
        balanced,
        message: balanced ? "Perfectly balanced" : "⚠️ Rebalancing recommended"
    });
});

// Daily counter reset (prevent long-term drift)
setInterval(() => {
    console.log("Daily reset: Cleared request counters");
    apiKeys.forEach(key => {
        requestCounts[key] = 0;
    });
}, 24 * 60 * 60 * 1000); // 24 hours

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
                <a href="https://stegopdf.com" 
                   style="display: inline-block; margin-top: 20px; padding: 14px 32px; background: #000; color: white; text-decoration: none; border-radius: 12px; font-weight: 600; transition: transform 0.2s;">
                   Visit StegoPDF Official
                </a>
            </div>
            <p style="margin-top: 30px; color: #999; font-size: 0.9rem;">© 2026 StegoPDF Protocol • Vercel Edge Deployment</p>
        </div>
    `);
});
app.listen(PORT, () => {
    console.log(`✅ Server running → http://localhost:${PORT}`);
    console.log(`📈 Stats: http://localhost:${PORT}/stats`);
    console.log(`🔑 Keys loaded: ${apiKeys.length}`);
});