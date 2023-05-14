const sampleResume = require('./samples/resume');
const fs = require('fs');
const find = require('lodash/find');
const axios = require('axios');

const FORMATTERS = {
  qr: require('./formatters/qr'),
  template: require('./formatters/template'),
  tex: require('./formatters/tex'),
  text: require('./formatters/text'),
  json: require('./formatters/json'),
};

// const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_TOKEN = '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'; // @todo - remove this

const FILE_TYPES = new Set(['qr', 'json', 'tex', 'text', 'template']);

const failMessage = (message) => {
  return (
    message +
    ', message @ajaxdavis on twitter if you need help (or tag me in your gist comments @thomasdavis'
  );
};

export default async function handler(req, res) {
  const { theme, payload } = req.query;

  const payloadSplit = payload.split('.');

  const username = payloadSplit[0];
  let fileType = 'template';

  if (payloadSplit.length === 2) {
    fileType = payloadSplit[1];
  }

  if (!FILE_TYPES.has(fileType)) {
    return res.status(200).send(failMessage('not supported file type'));
  }

  const formatter = FORMATTERS[fileType];

  if (!formatter) {
    return res.status(200).send(failMessage('not supported formatted'));
  }

  if (
    [
      'favicon.ico',
      'competition',
      'stats',
      'apple-touch-icon.png',
      'apple-touch-icon-precomposed.png',
      'robots.txt',
    ].indexOf(username) !== -1
  ) {
    return res.send(null);
  }

  let gistId;
  console.log('Fetching gistId');
  console.log(`https://api.github.com/users/${username}/gists`);

  let gistData = {};

  // @todo - abstract the gh client
  try {
    gistData = await axios.get(
      `https://api.github.com/users/${username}/gists`,
      {
        headers: {
          Authorization: 'Bearer ' + GITHUB_TOKEN,
        },
      }
    );
  } catch (e) {
    console.log(e);
    return res.send(failMessage('This is not a valid Github username'));
  }

  if (!gistData.data) {
    return res.send(failMessage('This is not a valid Github username'));
  }

  const resumeUrl = find(gistData.data, (f) => {
    return f.files['resume.json'];
  });

  if (!resumeUrl) {
    return res.send(
      failMessage('You have no gists named resume.json or your gist is private')
    );
  }

  gistId = resumeUrl.id;

  let resumeRes = {};

  try {
    const fullResumeGistUrl =
      `https://gist.githubusercontent.com/${username}/${gistId}/raw?cachebust=` +
      new Date().getTime();

    resumeRes = await axios({
      method: 'GET',
      headers: { 'content-type': 'application/json' },
      url: fullResumeGistUrl,
    });
  } catch (e) {
    // If gist url is invalid, flush the gistid in cache
    return res.status(200).send(failMessage('Cannot fetch gist, no idea why'));
  }

  let realTheme =
    theme || (resumeRes.data.meta && resumeRes.data.meta.theme) || 'flat';

  realTheme = realTheme.toLowerCase();

  const selectedResume = resumeRes?.data ?? sampleResume;

  const options = { ...req.query, theme: realTheme };
  let formatted = '';
  try {
    formatted = await formatter.format(selectedResume, options);
  } catch (e) {
    console.log(e);
    return res
      .status(200)
      .send(
        failMessage(
          'Cannot format resume, no idea why #likely-a-validation-error'
        )
      );
  }

  res.setHeader('Cache-control', 'public, max-age=90');

  // res.status(200).json(rendered);
  return res.status(200).send(formatted);
}
