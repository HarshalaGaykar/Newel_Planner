function getZonedDateParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  }).formatToParts(date);

  const get = (type) => Number(parts.find((p) => p.type === type)?.value || 0);

  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour') % 24,
    minute: get('minute'),
    second: get('second'),
  };
}

function getTimeZoneOffsetMs(date, timeZone) {
  const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const tzDate = new Date(date.toLocaleString('en-US', { timeZone }));
  return utcDate.getTime() - tzDate.getTime();
}

function getUtcForZonedLocalDateTime(timeZone, year, month, day, hour = 0, minute = 0, second = 0) {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, second, 0));
  const firstPass = new Date(utcGuess.getTime() - getTimeZoneOffsetMs(utcGuess, timeZone));
  return new Date(utcGuess.getTime() - getTimeZoneOffsetMs(firstPass, timeZone));
}

function getZonedDayRange(date, timeZone) {
  const parts = getZonedDateParts(date, timeZone);
  return {
    start: getUtcForZonedLocalDateTime(timeZone, parts.year, parts.month, parts.day),
    end: getUtcForZonedLocalDateTime(timeZone, parts.year, parts.month, parts.day + 1),
  };
}

const inputDate = new Date('2026-10-06T00:00:00.000Z');
console.log('Input:', inputDate.toISOString());
const range = getZonedDayRange(inputDate, 'Asia/Calcutta');
console.log('Range:', range);

const inputDate2 = new Date('2026-10-06T18:30:00.000Z');
console.log('\nInput2 (IST midnight? No, UTC):', inputDate2.toISOString());
console.log('Range2:', getZonedDayRange(inputDate2, 'Asia/Calcutta'));
