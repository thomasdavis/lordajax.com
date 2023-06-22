const { Client } = require('pg');
const gravatar = require('gravatar');
import { PineconeClient } from '@pinecone-database/pinecone';
const { Configuration, OpenAIApi } = require('openai');
import prisma from '../../lib/prisma';

if (!process.env.OPENAI_API_KEY) {
  throw new Error('Missing env var from OpenAI');
}

export const config = {
  runtime: 'edge',
};

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

const indexName = 'jsonresume-jobs';
// Create a client
const pinecone = new PineconeClient();

export default async function handler(req, res) {
  const client = new Client(process.env.DATABASE_URL_RAW);
  console.log('GOT REQUEST TO GET JOBS');
  console.log('GOT REQUEST TO GET JOBS');
  console.log('GOT REQUEST TO GET JOBS');
  console.log('GOT REQUEST TO GET JOBS');
  console.log('GOT REQUEST TO GET JOBS');
  await client.connect();

  const resume = await prisma.resumes.findUnique({
    where: {
      username,
    },
  });

  await pinecone.init({
    apiKey: process.env.PINECONE_API_KEY,
    environment: process.env.PINECONE_ENVIRONMENT,
  });

  const index = await pinecone.Index(indexName);
  const results = await client.query(
    `SELECT * from jobs ORDER BY created_at DESC`
  );

  const completion1 = await openai.createEmbedding({
    model: 'text-embedding-ada-002',
    input: JSON.stringify(resume),
  });

  const desiredLength = 2048;
  const namespace = 'jsonresume_jobs';

  let embedding = completion1.data.data[0].embedding;

  if (embedding.length < desiredLength) {
    embedding = embedding.concat(
      Array(desiredLength - embedding.length).fill(0)
    );
  }

  const vector = embedding;

  const queryRequest = {
    topK: 10,
    vector,
    namespace,
    includeMetadata: true,
    includeValues: false,
  };

  const queryResponse = await index.query({ queryRequest });
  const matches = queryResponse.matches.map((match) => {
    return JSON.parse(match.metadata.job);
  });
  return res.status(200).send(matches);
}
