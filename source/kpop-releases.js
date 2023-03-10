// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: pink; icon-glyph: calendar-alt;
// KPop Releases Widget by heismauri (v1.2.2)

const startWidget = async () => {
  // Variables
  const scriptVersion = '1.2.4';
  const PADDING = 15;
  const baseURL = 'https://raw.githubusercontent.com/heismauri/kpop-releases-widget/main';

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

  const groupByDateAndLimit = (releases, limit) => {
    return releases.slice(0, limit).reduce((accumulator, release) => {
      const key = release.date;
      accumulator[key] = accumulator[key] || [];
      accumulator[key].push(release.title);
      return accumulator;
    }, {});
  };

  // HTML Preview
  const encodeString = (text) => {
    return text.replace(/[\u00A0-\u9999<>&]/gim, (i) => `&#${i.charCodeAt(0)};`);
  };

  const releasesToHTML = (releases) => {
    return Object.keys(releases).map((day) => {
      const [date, time] = formatDate(new Date(parseInt(day, 10)));
      const title = `<ul class="calendar-day"><li class="calendar-day-date"><strong>${date}</strong><i>${time}</i></li>`;
      const listElements = releases[day].map((release) => {
        return `<li>${encodeString(release)}</li>`;
      });
      return [title, '<ul class="calendar-day-events">', ...listElements, '</ul></li></ul>'].join('');
    }).join('');
  };

  const HTMLBuilder = (releases) => {
    return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>KPop Upcoming Releases</title>
        <style>
          *{box-sizing:border-box}body{margin:0;color:#3c4142;font-size:1rem;font-family:-apple-system,'SF Pro Text','SF Pro Icons','Helvetica Neue','Helvetica','Arial',sans-serif;line-height:1.5}.calendar-day{margin:1rem 0;padding:0;list-style-type:none}.calendar-day-events{padding-left:2rem}.container{width:100%;max-width:30rem;padding:0 2rem;margin:0 auto}h1{color:#ce5891;text-transform:uppercase;margin-top:0;margin-bottom:.5rem;font-weight:bold;font-size:1rem}.calendar-day-date i{font-style:normal;margin-left:.25rem;opacity:.5}@media(prefers-color-scheme:dark){body{background:#201c1c;color:#fff}}
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🫰 KPop Upcoming Releases</h1>
          ${releasesToHTML(releases)}
        </div>
      </body>
    </html>
    `;
  };

  // Cache API
  const fm = FileManager.iCloud();
  const dir = fm.joinPath(fm.documentsDirectory(), 'kpop-releases-cache');
  if (!fm.fileExists(dir)) fm.createDirectory(dir);
  const apiCache = fm.joinPath(dir, 'api.json');

  // Get releases
  const getReleasesAPI = async () => {
    const request = new Request('https://gateway.reddit.com/desktopapi/v1/subreddits/kpop?include=structuredStyles');
    const json = await request.loadJSON();
    const allWidgets = json.structuredStyles.data.content.widgets.items;
    const releasesWidgetKey = getKeyByValue(allWidgets, 'Upcoming Releases');
    const allUpcomingReleases = allWidgets[releasesWidgetKey].data.map((release) => {
      return {
        title: release.title.split(' - ').filter((i) => i).join(' - '),
        date: release.startTime * 1000
      };
    });
    const sortedReleases = allUpcomingReleases
      .sort((a, b) => a.title.localeCompare(b.title))
      .sort((a, b) => a.date - b.date);
    fm.writeString(apiCache, JSON.stringify(sortedReleases));
  };

  const getReleases = async (limit) => {
    if (!fm.fileExists(apiCache)) await getReleasesAPI();
    await fm.downloadFileFromiCloud(apiCache);
    const content = await JSON.parse(fm.readString(apiCache));
    const timestamp = content.at(0).date;
    const oneHourAgo = new Date() - (4.2 * 10 ** 6);
    if (new Date(oneHourAgo) > new Date(parseInt(timestamp, 10))) {
      await getReleasesAPI();
      await getReleases();
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

  // Run get releases
  const releases = await getReleases(limit);

  // Widget
  const widget = new ListWidget();
  widget.setPadding(PADDING, 12, PADDING, PADDING);
  widget.backgroundColor = Color.dynamic(new Color('#ffffff'), new Color('#201c1c'));

  const widgetTitle = widget.addText('🫰 KPOP RELEASES');
  widgetTitle.font = Font.semiboldSystemFont(12);
  widgetTitle.textColor = new Color('#ce5891');

  const mainStack = widget.addStack();
  mainStack.setPadding(0, 3, 0, 0);
  mainStack.topAlignContent();
  mainStack.layoutVertically();

  mainStack.addSpacer();

  // Print each release by day
  Object.keys(releases).forEach((day) => {
    const dateStack = mainStack.addStack();
    dateStack.layoutHorizontally();
    const [date, time] = formatDate(new Date(parseInt(day, 10)));
    const dateText = dateStack.addText(date);
    dateText.font = Font.semiboldSystemFont(13);
    dateStack.addSpacer(4);
    const timeText = dateStack.addText(time);
    timeText.font = Font.regularSystemFont(13);
    timeText.textOpacity = 0.5;
    const spaceBetweenDates = Object.keys(releases).at(-1) === day ? 0 : 4;
    releases[day].forEach((release) => {
      const releaseStack = mainStack.addStack();
      const releaseText = releaseStack.addText(release);
      releaseText.font = Font.regularSystemFont(13);
    });
    mainStack.addSpacer(spaceBetweenDates);
  });

  mainStack.addSpacer();

  // Config Utilities
  // // Generate Alert
  const generateAlert = async (message, options) => {
    const alert = new Alert();
    alert.message = message;
    options.forEach((option) => {
      alert.addAction(option);
    });
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

  // Preview all releases, Clear cache, and update script
  if (!config.runsInWidget) {
    const options = ['View all upcoming releases', 'Clear cache'];
    if (await updateChecker()) options.push('Update now!');
    const response = await generateAlert('What would you like to do?', options);
    switch (response) {
      case 0: {
        const webView = new WebView();
        webView.loadHTML(HTMLBuilder(await getReleases()));
        await webView.present();
        break;
      }
      case 1: {
        await getReleasesAPI();
        break;
      }
      case 2: {
        let message;
        try {
          const upstreamScript = new Request(`${baseURL}/kpop-releases.js`);
          const kpopreleasesScript = await upstreamScript.loadString();
          fm.writeString(module.filename, kpopreleasesScript);
          message = 'The code has been updated. Please close your Scriptable app and run it again.';
        } catch (error) {
          message = 'The update has failed. Please try again later.';
        }
        await generateAlert(message, ['Close']);
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

startWidget();
