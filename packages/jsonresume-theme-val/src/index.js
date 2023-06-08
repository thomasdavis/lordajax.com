function generateHTML(resume) {
  // Create the basic HTML structure
  let html = `
  <!DOCTYPE html>
  <html>
  <head>
      <title>${resume.basics.name}'s Resume</title>
  </head>
  <body>
      <h1>${resume.basics.name}</h1>
      <p>${resume.basics.summary}</p>
      <h2>Work Experience</h2>
      ${generateWorkExperience(resume.work)}
      <h2>Skills</h2>
      ${generateSkills(resume.skills)}
  </body>
  </html>
  `;

  return html;
}

function generateWorkExperience(work) {
  let html = '';
  work.forEach((job) => {
    html += `
      <h3>${job.name}</h3>
      <h4>${job.position}</h4>
      <p>${job.startDate} - ${job.endDate || 'Present'}</p>
      <ul>
          ${job.highlights.map((highlight) => `<li>${highlight}</li>`).join('')}
      </ul>
      `;
  });

  return html;
}

function generateSkills(skills) {
  let html = '';
  skills.forEach((skill) => {
    html += `
      <h3>${skill.name}</h3>
      <p>Level: ${skill.level}</p>
      <ul>
          ${skill.keywords.map((keyword) => `<li>${keyword}</li>`).join('')}
      </ul>
      `;
  });

  return html;
}

export const render = (resume) => {
  return generateHTML(resume);
};

export default render;
