const format = async function format(resume) {
  const content = `
${resume.basics.name}
Pittsburgh, PA 15201
(555) 555-5555
example@example.com

PROFESSIONAL SUMMARY
============================
${resume.basics.summary}

WORK HISTORY
============================
${(resume.work ?? []).map(
  (work) => `
March 2014 to Current
${work.name} – ${work.location}
${work.position}

${(work.highlights ?? []).map((highlight) => `+ ${highlight}`).join('\n')}

---------------------------`
)}


SKILLS
============================
Conflict resolution techniques
Performance improvement
Staff management
Service-oriented
Trained in performance and wage reviews
Business operations
Inventory control and record keeping
Marketing and advertising

EDUCATION
============================
Park Point University Pittsburgh, PA
Bachelor of Arts Hospitality Management
`;

  return { content, headers: [] };
};

export default { format };
