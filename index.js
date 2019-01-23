"use strict";
require("dotenv").config();
const moment = require("moment");
const fs = require("fs");
const fetch = require("node-fetch");
const schedule = require("node-schedule");
const ical = require("ical-generator");
const http = require("http");
const Slack = require("slack-node");

const config = require("./config");
let queryCount = 0;

const sendWebHooks = (url, events, link) => {
  const slack = new Slack();
  slack.setWebhook(url);

  // query & event count limits to prevent flooding when service restarts
  if (events && queryCount < 3 && events.length < 10) {
    events.forEach(event => {
      slack.webhook(
        {
          channel: config.slack.channel,
          username: config.slack.username,
          text:
            event.summary +
            " varasi juuri studion " +
            moment(event.start).calendar() +
            " - " +
            moment(event.end).calendar() +
            "\n" +
            link
        },
        (err, resp) => {
          return;
        }
      );
    });
  }
};

const createEvents = (cal, reservations, resource, queryUrl) => {
  const calEvents = cal.events();
  const eventsOnCalendar = calEvents.map(event => {
    return event._data.id;
  });
  console.log({ eventsOnCalendar });
  let newEvents = reservations.map(reservation => {
    if (
      eventsOnCalendar.length === 0 ||
      !eventsOnCalendar.includes(reservation.reservation_id)
    ) {
      const newEvent = {
        id: reservation.reservation_id,
        start: new Date(reservation.reservation_start_time),
        end: new Date(reservation.reservation_end_time),
        summary: reservation.reserver_name,
        description: "",
        location: reservation.resource_name,
        url: queryUrl
      };
      cal.createEvent(newEvent);
      return newEvent;
    }
  });
  return newEvents;
};

const startServer = config => {
  const cal = ical({ domain: config.domain, name: config.calendarName });

  // overwrite domain
  cal.domain(config.domain);

  http
    .createServer(function(req, res) {
      cal.serve(res);
    })
    .listen(config.port, config.domain, function() {
      console.log("Server running at ", config.domain + ":" + config.port);
    });

  schedule.scheduleJob(config.cronInterval, async () => {
    queryCount += 1;
    // Set up query urls
    const today = moment().format("DDMMYYYY");
    const end = moment()
      .add(config.days, "days")
      .format("DDMMYYYY");
    const queryUrl =
      config.baseUrl + "?r=" + config.resource + ";fd=" + today + ";ld=" + end;
    console.log("queryCount ", queryCount);
    console.log("Query url ", queryUrl);
    const reservationsReq = await fetch(queryUrl);
    const reservations = await reservationsReq.json();
    console.log({ reservations });
    const newEvents = createEvents(
      cal,
      reservations,
      config.resource,
      queryUrl
    );

    if (config.slack.webhookUrl)
      sendWebHooks(config.slack.webhookUrl, newEvents, queryUrl);
  });
};

startServer(config);
