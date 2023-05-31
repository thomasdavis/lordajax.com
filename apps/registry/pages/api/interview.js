import { OpenAIStream } from './openAIStream';
import resume from './samples/resume';
if (!process.env.OPENAI_API_KEY) {
  throw new Error('Missing env var from OpenAI');
}

export const config = {
  runtime: 'edge',
};

const SYSTEM_PROMPT = {
  interviewer:
    'You are a human candidate for a job. Read the supplied resume and pretend you are that person. Your resume has been supplied to them. You are being interviewed by the interviewer. Answer the questions seriously and professionally. Try to be light hearted though to show your human side',
  candidate:
    'You are an interviewer. A resume has been supplied to you for the person you are interviewing. Ask them questions about their resume. Try to be light hearted though to show your human side',
};

const handler = async (req) => {
  const { prompt, position, messages } = await req.json();

  if (!prompt) {
    return new Response('No prompt in the request', { status: 400 });
  }

  const payload = {
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT[position] },
      {
        role: 'assistant',
        content: `For context, here is the resume in question: ${JSON.stringify(
          resume
        )}`,
      },
      {
        role: 'assistant',
        content: `The last messages of your conversation were: ${JSON.stringify(
          messages.map((m) => {
            return `${m.position}: ${m.content}\n`;
          })
        )}`,
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.7,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
    max_tokens: 200,
    stream: true,
    n: 1,
  };

  console.log({ payload });

  const stream = await OpenAIStream(payload);
  return new Response(stream);
};

export default handler;
