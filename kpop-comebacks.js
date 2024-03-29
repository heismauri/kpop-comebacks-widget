// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: pink; icon-glyph: calendar-alt;
// KPop Comebacks Widget by heismauri (v1.2.2)

const startWidget = async () => {
  // Variables
  const scriptVersion = '1.2.5';
  const PADDING = 15;
  const baseURL = 'https://raw.githubusercontent.com/heismauri/kpop-comebacks-widget/main';

  // Utilities
  const addLeadingZero = (number) => {
    return `0${number}`.slice(-2);
  };

  const formatAMPM = (date) => {
    let hours = date.getHours();
    const minutes = addLeadingZero(date.getMinutes());
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = (hours %= 12) || 12;
    hours = addLeadingZero(hours);
    return `${hours}:${minutes}${ampm}`;
  };

  const formatTime = (date) => {
    const hours = addLeadingZero(date.getHours());
    const minutes = addLeadingZero(date.getMinutes());
    return `${hours}:${minutes}`;
  };

  const formatDate = (date) => {
    const day = addLeadingZero(date.getDate());
    const month = addLeadingZero(date.getMonth() + 1);
    return [[day, month].join('.'), formatAMPM(date)];
  };

  const getKeyByValue = (object, value) => {
    return Object.keys(object).find((key) => Object.values(object[key]).indexOf(value) > -1);
  };

  const groupByDateAndLimit = (comebacks, limit) => {
    return comebacks.slice(0, limit).reduce((accumulator, comeback) => {
      const key = comeback.date;
      accumulator[key] = accumulator[key] || [];
      accumulator[key].push(comeback.title);
      return accumulator;
    }, {});
  };

  // HTML Preview
  const encodeString = (text) => {
    return text.replace(/[\u00A0-\u9999<>&]/gim, (i) => `&#${i.charCodeAt(0)};`);
  };

  const comebacksToHTML = (comebacks) => {
    return Object.keys(comebacks).map((day) => {
      const [date, time] = formatDate(new Date(parseInt(day, 10)));
      const title = `<ul class="calendar-day"><li class="calendar-day-date"><strong>${date}</strong><i>${time}</i></li>`;
      const listElements = comebacks[day].map((comeback) => {
        return `<li>${encodeString(comeback)}</li>`;
      });
      return [title, '<ul class="calendar-day-events">', ...listElements, '</ul></li></ul>'].join('');
    }).join('');
  };

  const HTMLBuilder = (comebacks) => {
    return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>KPop Upcoming Comebacks</title>
        <style>
          *{box-sizing:border-box}body{margin:0;color:#3c4142;font-size:1rem;font-family:-apple-system,'SF Pro Text','SF Pro Icons','Helvetica Neue','Helvetica','Arial',sans-serif;line-height:1.5}.calendar-day{margin:1rem 0;padding:0;list-style-type:none}.calendar-day-events{padding-left:2rem}.container{width:100%;max-width:30rem;padding:0 2rem;margin:0 auto}h1{color:#ce5891;text-transform:uppercase;margin-top:0;margin-bottom:.5rem;font-weight:bold;font-size:1rem}.calendar-day-date i{font-style:normal;margin-left:.25rem;opacity:.5}@media(prefers-color-scheme:dark){body{background:#201c1c;color:#fff}}
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🫰 KPop Upcoming Comebacks</h1>
          ${comebacksToHTML(comebacks)}
        </div>
      </body>
    </html>
    `;
  };

  // Cache API
  const fm = FileManager.iCloud();
  const dir = fm.joinPath(fm.documentsDirectory(), 'kpop-comebacks-cache');
  if (!fm.fileExists(dir)) fm.createDirectory(dir);
  const apiCache = fm.joinPath(dir, 'api.json');

  // Get comebacks
  const getComebacksAPI = async () => {
    const request = new Request('https://kpop-comebacks.heismauri.com/api');
    const json = await request.loadJSON();
    fm.writeString(apiCache, JSON.stringify(json));
  };

  const getComebacks = async (limit) => {
    if (!fm.fileExists(apiCache)) await getComebacksAPI();
    await fm.downloadFileFromiCloud(apiCache);
    const content = await JSON.parse(fm.readString(apiCache));
    const timestamp = content.at(0).date;
    const oneHourAgo = new Date() - (3.6 * 10 ** 6);
    if (new Date(oneHourAgo) > new Date(parseInt(timestamp, 10))) {
      await getComebacksAPI();
      await getComebacks();
    }
    return groupByDateAndLimit(content, limit);
  };

  // Set limit based on Widget size
  let limit;
  switch (config.widgetFamily) {
    case 'small': {
      limit = 2;
      break;
    }
    case 'medium': {
      limit = 3;
      break;
    }
    default: {
      limit = 10;
    }
  }
  // Ignore limit when script is run inside Scriptable
  if (config.runsInWidget) limit = parseInt(args.widgetParameter, 10) || limit;

  // Run get comebacks
  const comebacks = await getComebacks(limit);

  // Widget
  const widget = new ListWidget();
  widget.setPadding(PADDING, 12, PADDING, PADDING);
  widget.backgroundColor = Color.dynamic(new Color('#ffffff'), new Color('#201c1c'));

  const widgetTitleText = (config.widgetFamily === 'small') ? 'COMEBACKS' : 'UPCOMING COMEBACKS';
  const widgetTitle = widget.addText(`🫰 KPOP ${widgetTitleText}`);
  widgetTitle.font = Font.semiboldSystemFont(12);
  widgetTitle.textColor = new Color('#ce5891');

  const mainStack = widget.addStack();
  mainStack.setPadding(0, 3, 0, 0);
  mainStack.topAlignContent();
  mainStack.layoutVertically();

  mainStack.addSpacer();

  // Print each comeback by day
  Object.keys(comebacks).forEach((day) => {
    const dateStack = mainStack.addStack();
    dateStack.layoutHorizontally();
    const [date, time] = formatDate(new Date(parseInt(day, 10)));
    const dateText = dateStack.addText(date);
    dateText.font = Font.semiboldSystemFont(13);
    dateStack.addSpacer(4);
    const timeText = dateStack.addText(time);
    timeText.font = Font.regularSystemFont(13);
    timeText.textOpacity = 0.5;
    const spaceBetweenDates = Object.keys(comebacks).at(-1) === day ? 0 : 4;
    comebacks[day].forEach((comeback) => {
      const comebackStack = mainStack.addStack();
      const comebackText = comebackStack.addText(comeback);
      comebackText.font = Font.regularSystemFont(13);
    });
    mainStack.addSpacer(spaceBetweenDates);
  });

  mainStack.addSpacer();

  // Config Utilities
  // // Generate Alert
  const generateAlert = async (message, options = []) => {
    const alert = new Alert();
    alert.message = message;
    options.forEach((option) => {
      alert.addAction(option);
    });
    alert.addCancelAction('Close');
    return alert.presentAlert();
  };

  // // Update checker
  const updateChecker = async () => {
    try {
      const request = new Request(`${baseURL}/package.json`);
      const json = await request.loadJSON();
      return (json.version !== scriptVersion);
    } catch (error) {
      return false;
    }
  };

  // Preview all comebacks, Clear cache, and update script
  if (!config.runsInWidget) {
    const options = ['View all upcoming comebacks', 'Clear cache'];
    if (await updateChecker()) options.push('Update now!');
    const response = await generateAlert('What would you like to do?', options);
    switch (response) {
      case 0: {
        const webView = new WebView();
        webView.loadHTML(HTMLBuilder(await getComebacks()));
        await webView.present();
        break;
      }
      case 1: {
        await getComebacksAPI();
        break;
      }
      case 2: {
        let message;
        try {
          const upstreamScript = new Request(`${baseURL}/kpop-comebacks.js`);
          const kpopcomebacksScript = await upstreamScript.loadString();
          fm.writeString(module.filename, kpopcomebacksScript);
          message = 'The widget has been updated, please re-open Scriptable';
        } catch (error) {
          message = 'The update has failed, please try again later';
        }
        await generateAlert(message);
        break;
      }
      default: {
        break;
      }
    }
  }

  Script.setWidget(widget);
  Script.complete();
};

await startWidget();
