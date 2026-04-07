import nodemailer from "nodemailer";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(450).json({ error: 'Method not allowed' });
  }

  const { smtpConfig, emailData } = req.body;

  if (!smtpConfig || !emailData) {
    return res.status(400).json({ error: "Missing smtpConfig or emailData" });
  }

  const transporter = nodemailer.createTransport({
    host: smtpConfig.host,
    port: parseInt(smtpConfig.port),
    secure: smtpConfig.secure,
    auth: {
      user: smtpConfig.user,
      pass: smtpConfig.pass,
    },
  });

  try {
    const mailOptions: any = {
      from: \`"\${smtpConfig.fromName || "RH"}" <\${smtpConfig.user}>\`,
      to: emailData.to,
      subject: emailData.subject,
      html: emailData.html,
      attachments: emailData.attachments?.map((att: any) => ({
        filename: att.filename,
        content: Buffer.from(att.content, "base64"),
      })),
    };

    if (emailData.cc && emailData.cc.trim()) {
      mailOptions.cc = emailData.cc.trim();
    }

    const info = await transporter.sendMail(mailOptions);
    res.status(200).json({ success: true, messageId: info.messageId });
  } catch (error: any) {
    console.error("Error sending email:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}
