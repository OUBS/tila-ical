# TILA-ical

Small script that currently has 3 main features:

1. Gets reservations from [TILA](https://tila.ayy.fi/) space management system
2. Inserts reservations to ical calendar and servers it as .ical file
3. Sends webhooks to Slack about new reservations

## How to run

1. Create `.env` file, copy contents from `.env.example` and edit configs
2. npm install
3. node index.js
