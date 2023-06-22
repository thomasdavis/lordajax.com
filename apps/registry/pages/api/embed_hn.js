const { Client } = require('pg');
const gravatar = require('gravatar');
import { ChatGPTAPI } from 'chatgpt';
var hash = require('object-hash');
import YAML from 'json-to-pretty-yaml';
import { PineconeClient } from '@pinecone-database/pinecone';
const { Configuration, OpenAIApi } = require('openai');
import eachOfLimit from 'async/eachOfLimit';

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

const indexName = 'jsonresume-jobs';
// Create a client
const pinecone = new PineconeClient();

export default async function handler(req, res) {
  const client = new Client(process.env.DATABASE_URL_RAW);

  await client.connect();
  await pinecone.init({
    apiKey: process.env.PINECONE_API_KEY,
    environment: process.env.PINECONE_ENVIRONMENT,
  });

  const indexDescription = await pinecone.describeIndex({ indexName });
  const index = await pinecone.Index(indexName);
  const results = await client.query(
    `SELECT * from jobs ORDER BY created_at DESC`
  );

  const jobs = results.rows;
  eachOfLimit(jobs, 3, async (job, key, callback) => {
    try {
      const jobId = 'hn_' + job.uuid;

      const completion = await openai.createEmbedding({
        model: 'text-embedding-ada-002',
        input: JSON.stringify(job),
      });

      console.log('embedding', jobId);
      let embedding = completion.data.data[0].embedding;
      console.log(completion.data.data);
      const desiredLength = 2048;

      if (embedding.length < desiredLength) {
        embedding = embedding.concat(
          Array(desiredLength - embedding.length).fill(0)
        );
      }

      const vectors = [
        {
          id: jobId,
          values: [embedding],
          metadata: {
            job: JSON.stringify(job),
          },
        },
      ];

      const namespace = 'jsonresume_jobs';
      const upsertRequest = {
        vectors,
        namespace,
      };

      await index.upsert({ upsertRequest });
    } catch (err) {
      console.error('error executing query:', err);
    }
  });

  return res.status(200).send(results.rows);
}
