const sampleResume = require('./samples/resume');
const fs = require('fs');
import packages from './packages';

export default async function handler(req, res) {
  const themes = {};
  const packs = Object.keys(packages);
  console.log({ themes, packs });
  let boo = '';
  packs.forEach((value) => {
    themes[
      value
    ] = `https://registry.jsonresume.org/thomasdavis?theme=${value}`;
    boo += `'${value.replace(
      'jsonresume-theme-',
      ''
    )}': require('${value}'), \n`;
  });

  res.status(200).send(boo);
}
