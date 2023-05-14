const format = async function format(resume) {
  const YAML = require('json-to-pretty-yaml');
  const data = YAML.stringify(resume);
  return data;
};

export { format };
