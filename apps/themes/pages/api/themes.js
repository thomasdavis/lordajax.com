import packages from './packages';

export default async function handler(req, res) {
  const themes = {};
  const packs = Object.keys(packages);
  console.log({ themes, packs });
  let boo = '';
  packs.forEach((value) => {
    themes[
      value
    ] = `https://jsonresume-org-themes.vercel.app/thomasdavis?theme=${value.replace(
      'jsonresume-theme-',
      ''
    )}`;
    boo += `'${value.replace(
      'jsonresume-theme-',
      ''
    )}': require('${value}'), \n`;
  });

  res.status(200).send(themes);
}
