const express = require("express");
const cors = require("cors");
const { MongoClient } = require("mongodb");
const bcrypt = require("bcrypt");

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cors());
app.use(express.static("public"));

const uri = "mongodb+srv://Komali:event@event.7xefa.mongodb.net/?retryWrites=true&w=majority&appName=event";
const client = new MongoClient(uri);

let db, adminCollection, eventsCollection, paymentsCollection;

async function connectDB() {
    try {
        await client.connect();
        console.log("✅ Connected to MongoDB");
        db = client.db("event");
        adminCollection = db.collection("admin_credentials");
        eventsCollection = db.collection("events");
        paymentsCollection = db.collection("payments");
    } catch (error) {
        console.error("❌ MongoDB Connection Error:", error);
        process.exit(1);
    }
}

// Route to Handle Admin Login
app.post("/admin/login", async (req, res) => {
    const { userid, password } = req.body;

    if (!userid || !password) {
        return res.status(400).json({ message: "Userid and Password are required" });
    }

    try {
        const admin = await adminCollection.findOne({ userid });

        if (!admin || !(await bcrypt.compare(password, admin.password))) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        res.status(200).json({ message: "Login successful" });
    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ message: "Error during login" });
    }
});

// Route to Add a New Event
app.post("/api/events", async (req, res) => {
    try {
        console.log("Received POST request to /api/events");
        const { eventId, name, cost, date, time, location, image, status } = req.body;

        // Basic validation
        if (!eventId || !name || !cost || !date || !time || !location || !image || !status) {
            return res.status(400).json({ message: "All event fields are required!" });
        }

        // Additional Check: Ensure eventId is unique
        const existingEvent = await eventsCollection.findOne({ eventId });
        if (existingEvent) {
            return res.status(409).json({ message: `Event with eventId ${eventId} already exists!` });
        }

        const eventData = {
            eventId,
            name,
            cost,
            date: new Date(date),
            time,
            location,
            image,
            status,
            successCount: 0, // Initialize successCount to 0
            createdAt: new Date(),
            updatedAt: new Date()
        };

        console.log("Adding event:", eventData);
        const result = await eventsCollection.insertOne(eventData);
        res.status(201).json({ message: "Event added successfully", eventId: result.insertedId });
    } catch (error) {
        console.error("Error adding event:", error);
        res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
});

// Route to Fetch All Events
app.get("/api/events", async (req, res) => {
    try {
        const events = await eventsCollection.find().toArray();
        res.status(200).json(events);
    } catch (error) {
        console.error("Error fetching events:", error);
        res.status(500).json({ message: "Failed to fetch events" });
    }
});

// New Route to Record Successful QR Scan
app.post("/api/events/:eventId/scan", async (req, res) => {
    try {
        const { eventId } = req.params;

        const event = await eventsCollection.findOne({ eventId });
        if (!event) {
            return res.status(404).json({ message: "Event not found" });
        }

        const result = await eventsCollection.updateOne(
            { eventId },
            { 
                $inc: { successCount: 1 }, // Increment successCount
                $set: { updatedAt: new Date() }
            }
        );

        if (result.modifiedCount === 0) {
            return res.status(500).json({ message: "Failed to update success count" });
        }

        res.status(200).json({ 
            message: "Scan recorded successfully", 
            successCount: event.successCount + 1 
        });
    } catch (error) {
        console.error("Error recording scan:", error);
        res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
});

// Route to Save Payment
app.post("/api/payments", async (req, res) => {
    try {
        console.log("Received POST request to /api/payments");
        const { eventName, eventId, amount, date, userEmail } = req.body;

        // Basic validation
        if (!eventName || !eventId || !amount || !date || !userEmail) {
            return res.status(400).json({ message: "All payment fields are required!" });
        }

        // Additional Check: Prevent duplicate payment for the same eventId and userEmail
        const existingPayment = await paymentsCollection.findOne({ eventId, userEmail });
        if (existingPayment) {
            return res.status(409).json({ message: `User ${userEmail} has already paid for event ${eventId}!` });
        }

        const paymentData = {
            eventName,
            eventId,
            amount,
            date: new Date(date),
            userEmail,
            createdAt: new Date()
        };

        console.log("Saving payment:", paymentData);
        const result = await paymentsCollection.insertOne(paymentData);
        res.status(201).json({ message: "Payment saved successfully", paymentId: result.insertedId });
    } catch (error) {
        console.error("Error saving payment:", error);
        res.status(500).json({ message: "Internal Server Error", error: error.message });
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