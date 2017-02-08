"use strict";
const jsdom = require("jsdom");
const moment = require("moment");
const fs = require('fs');
const schedule = require('node-schedule');
const ical = require('ical-generator');
const http = require('http');
const Slack = require('slack-node');


// Read config file
let config;
fs.readFile('config.json', 'utf8', (err, data) => {
  if(err) throw err;
  config = JSON.parse(data);
  startServer(config)
});

let queryCount = 0;


function startServer(config) {
  const cal = ical({domain: config.domain, name: config.calendarName});

  // overwrite domain
  cal.domain(config.domain);

  http.createServer(function(req, res) {
    cal.serve(res);
  }).listen(config.port, config.domain, function() {
    console.log('Server running at ', config.domain + ':' + config.port);
  });


   schedule.scheduleJob(config.cronInterval, () => {
    queryCount +=1;
    // Set up query urls
    const today = moment().format('DDMMYYYY');
    const end = moment().add(config.days, 'days').format('DDMMYYYY');
    const queryUrl = config.baseUrl + '?r=' + config.resource + ";fd=" + today + ";ld=" + end;
    console.log('queryCount ', queryCount);
    console.log('new query to url ', queryUrl);
    getReservations(queryUrl)
      .then(data => {
        const reservations = parseReservations(data.header, data.data);

        const newEvents = createEvents(cal, reservations, config.resource, queryUrl);
        if (config.slack.webhookUrl) sendWebHooks(config.slack.webhookUrl, newEvents, queryUrl);
      })
     });
}


function getReservations(queryUrl) {
  return new Promise((resolve, reject) => {
    jsdom.env({
      url: queryUrl,
      scripts: ["http://code.jquery.com/jquery.js"],
      done: function(err, window) {
        if (err) return reject(err);
        const $ = window.$;
        let header = [];
        $(".table-responsive table tr th").each(function(i, v) {
          header[i] = $(this).text().trim();
        });

        let data = [];
        $(".table-responsive table tr").each(function(i, v) {
          $(this).children('td').each(function(ii, vv) {
            data[ii] = $(this).text().trim();
          });
        });

        resolve({header, data});
      }
    });
  });
}

function parseReservations(header, data) {
  let reservations = [];
  for(var d = 1; d < data.length; d++) {      // Start from index 1 to skip "confirmed/unconfirmed reservation" cell
    if (data[d].length > 0) {
      const reservation = data[d];
      let reservationStart, reservationEnd;
      const times = reservation.substring(reservation.length-12).split('-');

      if (times.length > 1) {
        reservationStart = times[0].length > 0 ? times[0] : '00:00';
        reservationEnd = times[1].length > 0 ? times[1] : '23:59';
      } else {
        reservationStart = '00:00';
        reservationEnd = '23:59';
      }
      const reserver = reservation;
      const reservationDate = header[d].substring(4, header[d].length);
      const dateStartString = reservationDate + " " + reservationStart;
      const dateEndString = reservationDate + " " + reservationEnd;
      const timeStart = moment(dateStartString, 'DD.MM.YYYY hh:mm').toDate();
      const timeEnd = moment(dateEndString, 'DD.MM.YYYY hh:mm').toDate();

      reservations.push({
        timeStart,
        timeEnd,
        reserver
      });
    }
  }
  return reservations;
}

function sendWebHooks(url, events, link) {
  const slack = new Slack();
  slack.setWebhook(url);

  if (events && queryCount < 3 &&  events.length < 5 ) {   // To prevent flooding on restart
    events.forEach((event) => {
      slack.webhook({
        channel: config.slack.channel,
        username: config.slack.username,
        text: event.summary + ' varasi juuri studion ' + moment(event.start).calendar() + '-' + moment(event.end).calendar() + '\n' + link
      },(err, resp) => {
        return;
      });
    })
  }

}

function createEvents(cal, reservations, resource, queryUrl) {
  const calEvents = cal.events();
  const eventsOnCalendar = calEvents.map((event) => {return event.summary()});
  let newEvents = [];
  reservations.forEach((reservation) => {
    if (eventsOnCalendar.length === 0  || !eventsOnCalendar.includes(reservation.reserver)) {
      const newEvent = {
        start: reservation.timeStart,
        end: reservation.timeEnd,
        summary: reservation.reserver,
        description: '',
        // location: resource,
        url: 'queryUrl'
      }
      newEvents.push(newEvent);
      cal.createEvent(newEvent);
    }
  })
  return newEvents;
}
