const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true, // Use SSL
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const sendEmail = async (to, subject, html) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error('Email configuration missing in .env (EMAIL_USER and EMAIL_PASS are required)');
  }

  try {
    const mailOptions = {
      from: `"NITC Alumni Portal" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    };

    await transporter.sendMail(mailOptions);
    console.log(`📧 Email sent to ${to}`);
    return true;
  } catch (error) {
    console.log('❌ Email Error:', error);
    return false;
  }
};

const escapeHtml = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

/**
 * Sends a premium styled Welcome/Invitation Email to registered alumni.
 */
sendEmail.sendWelcomeEmail = async ({ to, name, loginUrl, temporaryPassword, isInvite, isApproval }) => {
  const escapedName = escapeHtml(name);
  
  let subject = 'Welcome to the NITC MCA Alumni Network (MOMNITC)';
  let headerText = 'Welcome to MOMNITC!';
  let greetingText = `Dear ${escapedName},`;
  let leadText = 'We are thrilled to welcome you to the official NITC MCA Alumni Network portal.';
  
  if (isInvite) {
    subject = 'Invitation to join the official NITC MCA Alumni Portal - MOMNITC';
    headerText = 'You are Invited!';
    leadText = 'We are pleased to invite you to join the official NITC MCA Alumni Network portal.';
  } else if (isApproval) {
    subject = 'Your NITC Alumni Account is Approved!';
    headerText = 'Account Approved!';
    leadText = 'Great news! Your manual registration request has been reviewed and approved by the administrators.';
  }

  const credentialsBoxHtml = temporaryPassword ? `
    <div style="background-color: #f1f5f9; border-left: 4px solid #003399; padding: 20px; border-radius: 8px; margin: 25px 0; text-align: left;">
      <h3 style="margin: 0 0 10px 0; color: #003399; font-size: 15px; font-weight: bold; font-family: 'Helvetica Neue', Arial, sans-serif;">Your Access Credentials</h3>
      <p style="margin: 0; font-size: 14px; font-family: 'Helvetica Neue', Arial, sans-serif; color: #334155;"><strong>Email:</strong> ${escapeHtml(to)}</p>
      <p style="margin: 8px 0 0 0; font-size: 14px; font-family: 'Helvetica Neue', Arial, sans-serif; color: #334155;"><strong>Temporary Password:</strong> <code style="background: #e2e8f0; padding: 3px 6px; border-radius: 4px; font-family: Courier, monospace; font-size: 13px; font-weight: bold;">${escapeHtml(temporaryPassword)}</code></p>
      <p style="margin: 12px 0 0 0; font-size: 12px; color: #64748b; font-style: italic; font-family: 'Helvetica Neue', Arial, sans-serif;">* For security, please change this password immediately after your first login.</p>
    </div>
  ` : '';

  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${escapeHtml(subject)}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f4f6f9; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f4f6f9; width: 100%;">
        <tr>
          <td align="center" style="padding: 25px 10px;">
            <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); line-height: 1.6; color: #333333; background: #ffffff; text-align: left;">
              
              <!-- Header Gradient -->
              <div style="background: linear-gradient(135deg, #003399 0%, #6c3fc5 100%); padding: 30px 25px; text-align: center; color: #ffffff;">
                <h1 style="margin: 0; font-size: 24px; font-weight: bold; letter-spacing: -0.5px; font-family: 'Helvetica Neue', Arial, sans-serif;">MOMNITC</h1>
                <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.9; font-family: 'Helvetica Neue', Arial, sans-serif;">Member of MCA NITC Alumni Network</p>
              </div>

              <!-- Content Body -->
              <div style="padding: 35px 30px; background: #ffffff;">
                <h2 style="margin-top: 0; margin-bottom: 20px; color: #003399; font-size: 20px; font-weight: bold; font-family: 'Helvetica Neue', Arial, sans-serif;">${escapeHtml(headerText)}</h2>
                
                <p style="font-size: 15px; margin-bottom: 15px; font-family: 'Helvetica Neue', Arial, sans-serif;">${greetingText}</p>
                <p style="font-size: 15px; margin-bottom: 15px; font-family: 'Helvetica Neue', Arial, sans-serif;">${leadText}</p>
                
                <p style="font-size: 15px; margin-bottom: 15px; font-family: 'Helvetica Neue', Arial, sans-serif;">
                  The Centre of Excellence in Artificial Intelligence (CoE-AI) at NIT Calicut has developed this platform exclusively for the esteemed MCA alumni of REC Calicut/NIT Calicut. 
                  <b>MOMNITC</b> acts as a digital bridge connecting all batches to the Alma mater.
                </p>
                
                <p style="font-size: 15px; margin-bottom: 15px; font-family: 'Helvetica Neue', Arial, sans-serif;">
                  We have many exciting initiatives in the pipeline, including batch reunions, family get-togethers, and an annual alumni conference. 
                  Please explore the portal to view the alumni directory, stay updated on events, and connect with your colleagues.
                </p>

                ${credentialsBoxHtml}

                <div style="text-align: center; margin: 35px 0;">
                  <a href="${escapeHtml(loginUrl)}" style="background: linear-gradient(135deg, #003399 0%, #4a90e2 100%); color: #ffffff; padding: 13px 32px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block; box-shadow: 0 4px 8px rgba(0, 51, 153, 0.2); font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 15px; transition: all 0.3s ease;">Explore MOMNITC Portal</a>
                </div>

                <hr style="border: 0; border-top: 1px solid #eaeaea; margin: 30px 0;">

                <div style="font-size: 12px; color: #64748b; line-height: 1.5; font-family: 'Helvetica Neue', Arial, sans-serif;">
                  <p style="margin: 0; font-weight: bold; color: #334155;">With warm regards,</p>
                  <p style="margin: 8px 0 0 0;">
                    <strong>डॉ. एस डी मधुकुमार / Dr. S.D. Madhu Kumar</strong><br>
                    प्रोफेसर / Professor,<br>
                    कंप्यूटर साइंस और इंजीनियरिंग विभाग / Dept. of Computer Science & Engineering,<br>
                    चेयरपर्सन - सेंटर ऑफ़ एक्सीलेंस इन आर्टिफिशियल इंटेलिजेंस / Chairperson – Centre of Excellence in AI (CoE-AI),<br>
                    राष्ट्रीय प्रौद्योगिकी संस्थान कालिकट / National Institute of Technology Calicut<br>
                    फ़ोन: +91-495-228 5072 / Ph: +91-495-228 5072<br>
                    <a href="https://nitc.ac.in" style="color: #003399; text-decoration: none; font-weight: 500;">Institute Homepage</a>
                  </p>
                </div>
              </div>

              <!-- Footer -->
              <div style="background-color: #f8fafc; padding: 20px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; font-family: 'Helvetica Neue', Arial, sans-serif;">
                &copy; ${new Date().getFullYear()} National Institute of Technology, Calicut. All rights reserved.
              </div>

            </div>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return await sendEmail(to, subject, emailHtml);
};

module.exports = sendEmail;