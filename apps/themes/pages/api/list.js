import themes from './npm';

export default async function handler(req, res) {
  const list = themes.objects.map((theme) => {
    return {
      name: theme.package.name,
    };
  });
  let themeString = '';
  list.forEach((theme) => {
    themeString += `pnpm i ${theme.name} \n`;
  });
  res.status(200).send(themeString);
}
