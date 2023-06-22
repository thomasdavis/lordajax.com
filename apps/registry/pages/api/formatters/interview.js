import { ChatGPTAPI } from 'chatgpt';
var hash = require('object-hash');
import YAML from 'json-to-pretty-yaml';
import { PineconeClient } from '@pinecone-database/pinecone';
const { Configuration, OpenAIApi } = require('openai');

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

const indexName = 'jsonresume';
// Create a client
const pinecone = new PineconeClient();

const format = async function format(resume) {
  const OPENAI_API_KEY = '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';
  const data = YAML.stringify(resume);
  // const resumeHash = hash(resume.basics.email);
  // // Initialize the client
  // await pinecone.init({
  //   apiKey: process.env.PINECONE_API_KEY,
  //   environment: process.env.PINECONE_ENVIRONMENT,
  // });

  // const indexDescription = await pinecone.describeIndex({ indexName });
  // const index = await pinecone.Index(indexName);
  // // console.log({ indexDescription });

  // const completion = await openai.createEmbedding({
  //   model: 'text-embedding-ada-002',
  //   input: JSON.stringify(resume),
  // });

  // console.log('embedding', resumeHash);
  // let embedding = completion.data.data[0].embedding;
  // console.log(completion.data.data);
  // const desiredLength = 2048;

  // if (embedding.length < desiredLength) {
  //   embedding = embedding.concat(
  //     Array(desiredLength - embedding.length).fill(0)
  //   );
  // }

  // const vectors = [
  //   {
  //     id: resumeHash,
  //     values: [embedding],
  //     metadata: {
  //       resume: JSON.stringify(resume),
  //     },
  //   },
  // ];

  // const namespace = 'resumes';
  // const upsertRequest = {
  //   vectors,
  //   namespace,
  // };
  // await index.upsert({ upsertRequest });

  // const completion1 = await openai.createEmbedding({
  //   model: 'text-embedding-ada-002',
  //   input: 'what is god zilla',
  // });
  // embedding = completion1.data.data[0].embedding;

  // if (embedding.length < desiredLength) {
  //   embedding = embedding.concat(
  //     Array(desiredLength - embedding.length).fill(0)
  //   );
  // }

  // // const vector = vectors[0];
  // const vector = embedding;
  // // run a query
  // const queryRequest = {
  //   topK: 1,
  //   vector,
  //   namespace,
  //   includeMetadata: true,
  //   includeValues: true,
  // };

  // console.log({ queryRequest });

  // const queryResponse = await index.query({ queryRequest });
  // console.log({ queryResponse });
  // console.log(queryResponse.matches);

  // say that this interview is over.
  // sorry mr davis but this interview is over.
  const prompt = `
  You are a bot acting as a human interviewer. Please interview this candidate professionally and concise.
  If the candidate is talking too much nonsense, please end the interview rudely.
  Here is there resume in JSON.

  ${data}

  Interviewer:Hello, how are you?
  Candidate: I am good, how are you?
  Interviewer:What was your first job?
  Candidate: I worked as a fire man
  Interviewer:What motivated you to become a web developer?
  Candidate: I am not a web developer
  Interviewer: It say's on your resume that you worked as a web developer as your first job.
  Candidate: I think you are monkey poo
  Interviewer: 
  `;

  const comp3 = await openai.createCompletion({
    model: 'text-davinci-003',
    prompt,
  });

  console.log(comp3.data.choices, comp3.data.usage);

  return { content: 'asd', headers: [] };
};

export default { format };
