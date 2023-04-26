const format = async function format(resume) {
  return JSON.stringify(resume, undefined, 4);
};

export { format };
