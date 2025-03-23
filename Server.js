const express = require("express");
const cors = require("cors");
const { MongoClient } = require("mongodb");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(cors());
app.use(express.static("public")); // Serve static files from 'public' folder

// MongoDB Connection
const uri = "mongodb+srv://Komali:event@event.7xefa.mongodb.net/?retryWrites=true&w=majority&appName=event";
const client = new MongoClient(uri);

let db, usersCollection, eventsCollection;

async function connectDB() {
    try {
        await client.connect();
        console.log("✅ Connected to MongoDB");
        db = client.db("event"); // Use the "event" database for both users and events
        usersCollection = db.collection("users");
        eventsCollection = db.collection("events");
    } catch (error) {
        console.error("❌ MongoDB Connection Error:", error);
        process.exit(1); // Exit if connection fails
    }
}

// Email Transporter (Nodemailer)
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: "purnatejithad@gmail.com", // Replace with your Gmail
        pass: "yexm wbpd ylar yddu",    // Use an App Password
    },
});

// Store verification codes temporarily
const verificationCodes = {};

// Signup API
app.post("/signup", async (req, res) => {
    try {
        const { name, email, phone, password } = req.body;

        if (!name || !email || !phone || !password) {
            return res.status(400).json({ message: "All fields are required!" });
        }

        const user = await usersCollection.findOne({ email });
        if (user) return res.status(400).json({ message: "User already exists!" });

        const hashedPassword = await bcrypt.hash(password, 10);
        await usersCollection.insertOne({ name, email, phone, password: hashedPassword });

        res.json({ message: "User registered successfully!" });
    } catch (error) {
        console.error("Signup Error:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

// Login API
app.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required!" });
        }

        const user = await usersCollection.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: "User not found!" });
        }

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            return res.status(401).json({ message: "Incorrect password!" });
        }

        res.json({ message: "Login successful!" });
    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

// Forgot Password (Send Code)
app.post("/forgot-password", async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: "Email is required!" });
        }

        const user = await usersCollection.findOne({ email });
        if (!user) return res.status(404).json({ message: "Email not found!" });

        const code = Math.floor(100000 + Math.random() * 900000); // 6-digit code
        verificationCodes[email] = code;

        const mailOptions = {
            from: "purnatejithad@gmail.com",
            to: email,
            subject: "Password Reset Code",
            text: `Your password reset code is: ${code}`, // Fixed string formatting
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error("Email Error:", error);
                return res.status(500).json({ message: "Error sending email" });
            }
            res.json({ message: "Verification code sent successfully!" });
        });
    } catch (error) {
        console.error("Forgot Password Error:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

// Verify Code API
app.post("/verify-code", async (req, res) => {
    try {
        const { email, code } = req.body;

        if (!email || !code) {
            return res.status(400).json({ message: "Email and code are required!" });
        }

        if (!verificationCodes[email] || verificationCodes[email] != code) {
            return res.status(400).json({ message: "Invalid or expired code!" });
        }

        delete verificationCodes[email]; // Remove code after verification
        res.json({ message: "Code verified! You can now reset your password." });
    } catch (error) {
        console.error("Verification Error:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

// Change Password API
app.post("/change-password", async (req, res) => {
    try {
        const { email, newPassword } = req.body;

        if (!email || !newPassword) {
            return res.status(400).json({ message: "Email and new password are required!" });
        }

        const user = await usersCollection.findOne({ email });
        if (!user) return res.status(404).json({ message: "User not found!" });

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await usersCollection.updateOne({ email }, { $set: { password: hashedPassword } });

        res.json({ message: "Password changed successfully!" });
    } catch (error) {
        console.error("Change Password Error:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

// Send OTP Code API
app.post("/send-code", async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: "Email is required!" });
        }

        const code = Math.floor(100000 + Math.random() * 900000); // 6-digit OTP
        verificationCodes[email] = code;

        const mailOptions = {
            from: "purnatejithad@gmail.com",
            to: email,
            subject: "Your OTP Code",
            text: `Your verification code is: ${code}`, // Fixed string formatting
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error("Email Error:", error);
                return res.status(500).json({ message: "Error sending email" });
            }
            res.json({ message: "OTP sent successfully!" });
        });
    } catch (error) {
        console.error("Send Code Error:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

// Logout API (Simple response, no session management implemented)
app.post("/logout", (req, res) => {
    try {
        res.json({ message: "Logout successful!" });
    } catch (error) {
        console.error("Logout Error:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

// Fetch Events API
app.get("/api/events", async (req, res) => {
    try {
        const events = await eventsCollection.find({}).toArray();
        console.log("Fetched events:", events); // Debug log
        // Map MongoDB _id to id for the frontend
        const mappedEvents = events.map(event => ({
            ...event,
            id: event._id.toString(),
            _id: undefined // Remove _id field
        }));
        res.json(mappedEvents);
    } catch (error) {
        console.error("Error fetching events:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

// Start the Server
async function startServer() {
    await connectDB();
    app.listen(PORT, () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
}

startServer();

// Graceful Shutdown
process.on("SIGTERM", async () => {
    await client.close();
    console.log("🔒 MongoDB connection closed");
    process.exit(0);
});