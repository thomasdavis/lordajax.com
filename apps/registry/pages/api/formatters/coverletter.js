import { ChatGPTAPI } from 'chatgpt';
// const YAML = require('json-to-pretty-yaml');
import YAML from 'json-to-pretty-yaml';
console.log('covereltter');
const format = async function format(resume) {
  // return JSON.stringify(resume, undefined, 4);
  const OPENAI_API_KEY = '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';
  const data = YAML.stringify(resume);
  const api = new ChatGPTAPI({
    apiKey: OPENAI_API_KEY,
    // apiKey: process.env.OPENAI_API_KEY,
    completionParams: {
      // model: 'gpt-4',
      temperature: 0.9,
      top_p: 0.8,
    },
  });
  const prompt = `
Hi there, this is my resume in the YAML format. 
  
${data}

Please write me a cover letter
`;
  const res = await api.sendMessage(prompt);
  console.log(res.text);
  return res.text;
};

export default format;
