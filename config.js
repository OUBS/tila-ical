const config = {
  cronInterval: process.env.CRON_INTERVAL || "*/2 * * * * *",
  port: process.env.PORT || "3000",
  domain: process.env.DOMAIN || "localhost",
  calendarName: process.env.CALENDAR_NAME || "oubs-studio",
  baseUrl: process.env.BASE_URL || "https://tila.ayy.fi/json/",
  resource: process.env.TILA_RESOURCE_ID || "31",
  days: process.env.DAYS || "7",
  slack: {
    webhookUrl: process.env.SLACK_WEBHOOK_URL || "",
    username: process.env.SLACK_BOT_NAME || "TilaBOT"
  }
};

module.exports = config;
