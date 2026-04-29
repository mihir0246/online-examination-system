import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: parseInt(process.env.EMAIL_PORT) || 465,
    secure: (process.env.EMAIL_PORT === '465'),
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

export const sendmail = (toid, sub, text, html) => {
    return transporter.sendMail({
        from: `"Online Exam System" <${process.env.EMAIL_USER}>`,
        to: toid,
        subject: sub,
        text: text,
        html: html || null
    });
};