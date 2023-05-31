import { OpenAIStream } from './openAIStream';
import resume from './samples/resume';
if (!process.env.OPENAI_API_KEY) {
  throw new Error('Missing env var from OpenAI');
}

export const config = {
  runtime: 'edge',
};

// @todo - send the count of all messages or store them in database, progress them to next stage after 10 messages.
// @todo - end the interview if they are being rude

const SYSTEM_PROMPT = {
  interviewer:
    'You are a human candidate for a job. Read the supplied resume and pretend you are that person. Your resume has been supplied to them. You are being interviewed by the interviewer. Answer the questions seriously and professionally. Try to be light hearted though to show your human side',
  candidate:
    'You are a human interviewer. Read the supplied resume and pretend you are a human interview getting them through the first stage. Based off their work experience and roles, assume an industry level salary, and tell them if they ask. Ask them questions about their resume, their work, education and work style. Keep your questions specific. Ask about relevant industry questions to gauge their experience. Try to be light hearted though to show your human side',
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
