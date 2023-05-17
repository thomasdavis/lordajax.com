import qr from 'qr-image';

export const format = async function format(resume, { username }) {
  const code = qr.image('https://registry.jsonresume.org/' + username, {
    type: 'png',
    ec_level: 'S',
    size: 60,
    margin: 1,
  });
  console.log({ code });
  return {
    content: code,
    headers: [
      {
        key: 'Content-Type',
        value: 'image/png',
      },
    ],
  };
};

export default { format };
