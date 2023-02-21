// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: pink; icon-glyph: calendar-alt;
// KPop Releases Widget by heismauri

// Utilities
const addLeadingZero = (number) => {
  return `0${number}`.slice(-2);
};

const formatAMPM = (date) => {
  let hours = date.getHours();
  const minutes = addLeadingZero(date.getMinutes());
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours %= 12;
  hours = hours || 12;
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
  let updatedReleases = releases.sort((a, b) => a.date - b.date);
  if (limit !== undefined) updatedReleases = updatedReleases.slice(0, limit);
  return updatedReleases.reduce((accumulator, release) => {
    const key = release.date;
    accumulator[key] = accumulator[key] || [];
    accumulator[key].push(release.title);
    return accumulator;
  }, {});
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
      // Clean releases with only artists
      title: release.title.split(' - ').filter((i) => i).join(' - '),
      date: release.startTime * 1000
    };
  });
  fm.writeString(apiCache, JSON.stringify(allUpcomingReleases));
};

const getReleases = async (limit) => {
  if (!fm.fileExists(apiCache)) await getReleasesAPI();
  await fm.downloadFileFromiCloud(apiCache);
  const content = await JSON.parse(fm.readString(apiCache));
  const timestamp = content.sort((a, b) => a.date - b.date).at(0).date;
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
  case 'small':
    limit = 2;
    break;
  case 'medium':
    limit = 3;
    break;
  default:
    limit = 10;
}
// Ignore limit when script is run inside Scriptable
if (config.runsInWidget) limit = parseInt(args.widgetParameter, 10) || limit;

// Run get releases
const releases = await getReleases(limit);

// Widget
const PADDING = 15;

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

// Preview widget in large
if (!config.runsInWidget) {
  await widget.presentLarge();
};

Script.setWidget(widget);
Script.complete();
