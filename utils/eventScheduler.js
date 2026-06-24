const mongoose = require('mongoose');
const Event = require('../models/Event');
const Alumni = require('../models/alumni');
const sendEmail = require('./sendemails');

// Function to check and send reminders
const sendEventReminders = async () => {
  try {
    const tomorrowStart = new Date();
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    tomorrowStart.setHours(0, 0, 0, 0);

    const tomorrowEnd = new Date();
    tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
    tomorrowEnd.setHours(23, 59, 59, 999);

    // Find all approved events happening tomorrow that haven't had reminders sent
    const events = await Event.find({
      status: 'Approved',
      date: { $gte: tomorrowStart, $lte: tomorrowEnd },
      reminderSent: { $ne: true }
    }).populate('registeredUsers.user');

    if (events.length === 0) {
      return;
    }

    console.log(`[Scheduler] Found ${events.length} event(s) happening tomorrow. Sending reminders...`);

    for (const event of events) {
      const { title, date, time, location, description, contact, registeredUsers } = event;
      const eventDateStr = new Date(date).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      const usersToNotify = registeredUsers.filter(ru => ru.user && ru.user.email);
      console.log(`[Scheduler] Event "${title}" has ${usersToNotify.length} registered user(s) to notify.`);

      for (const regUser of usersToNotify) {
        const user = regUser.user;
        const emailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>Event Reminder: ${title}</title>
            <style>
              body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f6f9; margin: 0; padding: 0; color: #333333; }
              .container { max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05); overflow: hidden; border: 1px solid #e1e8ed; }
              .header { background: linear-gradient(135deg, #003399 0%, #6c3fc5 100%); color: #ffffff; padding: 30px 20px; text-align: center; }
              .header h1 { margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }
              .content { padding: 30px 25px; line-height: 1.6; }
              .greeting { font-size: 18px; font-weight: 600; margin-bottom: 15px; color: #111111; }
              .intro { font-size: 15px; margin-bottom: 25px; color: #555555; }
              .details-card { background-color: #f8fafc; border-radius: 8px; border-left: 4px solid #003399; padding: 20px; margin-bottom: 25px; }
              .detail-item { margin-bottom: 12px; font-size: 14px; }
              .detail-item:last-child { margin-bottom: 0; }
              .detail-label { font-weight: bold; color: #475569; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; margin-bottom: 2px; }
              .detail-value { font-size: 15px; color: #1e293b; }
              .description-title { font-weight: 600; font-size: 15px; margin-bottom: 8px; color: #111111; }
              .description-body { font-size: 14px; color: #4b5563; margin-bottom: 25px; white-space: pre-line; }
              .footer { background-color: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Event Reminder</h1>
              </div>
              <div class="content">
                <div class="greeting">Hi ${user.name || 'Alumni'},</div>
                <div class="intro">This is a friendly reminder that you are registered for our upcoming event happening tomorrow. We look forward to your presence!</div>
                
                <div class="details-card">
                  <div class="detail-item">
                    <div class="detail-label">Event Title</div>
                    <div class="detail-value" style="font-weight: 600; color: #003399;">${title}</div>
                  </div>
                  <div class="detail-item">
                    <div class="detail-label">Date & Time</div>
                    <div class="detail-value">${eventDateStr} at ${time}</div>
                  </div>
                  <div class="detail-item">
                    <div class="detail-label">Location</div>
                    <div class="detail-value">${location}</div>
                  </div>
                  ${contact ? `
                  <div class="detail-item">
                    <div class="detail-label">Contact Reference</div>
                    <div class="detail-value">${contact}</div>
                  </div>
                  ` : ''}
                </div>

                <div class="description-title">Event Details:</div>
                <div class="description-body">${description}</div>
              </div>
              <div class="footer">
                This is an automated notification from the NITC MCA Alumni Network.<br>
                Please do not reply directly to this email.
              </div>
            </div>
          </body>
          </html>
        `;

        await sendEmail(user.email, `Reminder: ${title} is happening tomorrow!`, emailHtml);
      }

      // Mark reminders as sent for this event
      event.reminderSent = true;
      await event.save();
    }
  } catch (error) {
    console.error('[Scheduler Error] Failed to send event reminders:', error);
  }
};

// Scheduler initializer
const initEventScheduler = () => {
  console.log('⏰ Event reminder scheduler initialized (checking every 2 hours)...');
  
  // Run check immediately on start
  sendEventReminders();

  // Run check every 2 hours (2 * 60 * 60 * 1000 = 7200000 ms)
  setInterval(sendEventReminders, 7200000);
};

module.exports = {
  sendEventReminders,
  initEventScheduler
};
