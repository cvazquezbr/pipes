import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import nodemailer from "nodemailer";

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "50mb" }));
  const server = createServer(app);

  app.post("/api/send-email", async (req, res) => {
    const { smtpConfig, emailData } = req.body;

    if (!smtpConfig || !emailData) {
      return res.status(400).json({ error: "Missing smtpConfig or emailData" });
    }

    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: parseInt(smtpConfig.port),
      secure: smtpConfig.secure, // true for 465, false for other ports
      auth: {
        user: smtpConfig.user,
        pass: smtpConfig.pass,
      },
    });

    try {
      const info = await transporter.sendMail({
        from: `"${smtpConfig.fromName || "RH"}" <${smtpConfig.user}>`,
        to: emailData.to,
        cc: emailData.cc,
        subject: emailData.subject,
        html: emailData.html,
        attachments: emailData.attachments?.map((att: any) => ({
          filename: att.filename,
          content: Buffer.from(att.content, "base64"),
        })),
      });

      res.json({ success: true, messageId: info.messageId });
    } catch (error: any) {
      console.error("Error sending email:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Serve static files from dist/public in production
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.static(staticPath));

  // Handle client-side routing - serve index.html for all routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = process.env.PORT || 3000;

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
