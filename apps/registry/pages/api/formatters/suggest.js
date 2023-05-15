import { ChatGPTAPI } from 'chatgpt';
import YAML from 'json-to-pretty-yaml';

const format = async function format(resume) {
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

  Please give me detail suggestions on how to improve it e.g.
  - Bad spelling and grammar
  - Sentences that seem irrelvant
  - Better ways of saying things
  - Jobs and skills that I could have described better

  Do not give general tips. Be as specific about my actual resume as possible.
  `;

  const res = await api.sendMessage(prompt);
  return res.text;
};

export default format;
