const { Client } = require('pg');
const gravatar = require('gravatar');

export default async function handler(req, res) {
  const client = new Client(process.env.DATABASE_URL);

  (async () => {
    await client.connect();
    try {
      const results = await client.query(
        `SELECT username, resume, updated_at from resumes ORDER BY updated_at DESC`
      );
      const resumes = results.rows.map((row) => {
        const resume = JSON.parse(row.resume);
        return {
          username: row.username,
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
    } catch (err) {
      console.error('error executing query:', err);
      return res.status(200).send('failed err');
    } finally {
      client.end();
      return res.status(200).send('failed');
    }
  })();
}
