const sampleResume = require("./samples/resume");

const THEMES = { paper: require("jsonresume-theme-paper") };

const FORMATTERS = {
  qr: require("./formatters/qr"),
  template: require("./formatters/template"),
};

const FILE_TYPES = new Set(["qr", "json", "text", "template"]);

export default async function handler(req, res) {
  const { theme, payload } = req.query;
  const { resume } = req.body;

  const selectedResume = resume ?? sampleResume;

  const payloadSplit = payload.split(".");

  const username = payloadSplit[0];
  let fileType = "template";

  if (payloadSplit.length === 2) {
    fileType = payloadSplit[1];
  }

  if (!FILE_TYPES.has(fileType)) {
    return res.status(200).send("not supported file type");
  }

  console.log({ fileType });

  const formatter = FORMATTERS[fileType];

  if (!formatter) {
    return res.status(200).send("not supported formatted");
  }

  const formatted = await formatter.format(selectedResume, req.query);
  console.log(formatted);

  // const rendered = {
  //   theme,
  //   username,
  //   formatted,
  //   selectedResume,
  //   fileType,
  // };

  // res.status(200).json(rendered);
  res.status(200).send(formatted);
}
