// @todo - this is a work in progress file that creates embeddings for hacker news who is hiring posts
const { Client } = require('pg');
const gravatar = require('gravatar');
import axios from 'axios';
import eachOfLimit from 'async/eachOfLimit';
export default async function handler(req, res) {
  const client = new Client(process.env.DATABASE_URL_RAW);

  await client.connect();

  const response = await axios.get(
    'https://hn.algolia.com/api/v1/search_by_date?tags=comment,story_36152014&hitsPerPage=1000'
  );

  const jobs = response.data.hits;

  eachOfLimit(jobs, 3, async (job, key, callback) => {
    try {
      const results = await client.query(
        `INSERT INTO jobs (type, uuid, content, raw, posted_at) VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (uuid) 
          DO 
            UPDATE SET content = $3`,
        [
          'hn',
          job.objectID,
          job.comment_text,
          JSON.stringify(job),
          new Date(job.created_at_i * 1000),
        ]
      );
      console.log({ results });
    } catch (err) {
      console.error('error executing query:', err);
    }
  });

  return res.send(jobs);
  const results = await client.query(
    `SELECT username, resume, updated_at from resumes ORDER BY updated_at DESC`
  );
  const resumes = results.rows.map((row) => {
    const resume = JSON.parse(row.resume);
    return {
      username: row.username,
      label: resume?.basics?.label,
      image:
        resume?.basics?.image ||
        gravatar.url(
          resume?.basics?.email,
          { s: '200', r: 'x', d: 'retro' },
          true
        ),
      updated_at: row.updated_at,
    };
  });
  return res.status(200).send(resumes);
}
