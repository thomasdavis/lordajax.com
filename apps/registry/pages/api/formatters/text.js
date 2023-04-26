const format = async function format(resume) {
  return `
${resume.basics.name}
Pittsburgh, PA 15201
(555) 555-5555
example@example.com

PROFESSIONAL SUMMARY
============================
${resume.basics.summary}

WORK HISTORY
============================
${resume.work.map(
  (w) => `
March 2014 to Current
Outback Steakhouse – Pittsburgh, PA
Restaurant Manager

+ Reduced labor costs by 17% percent while maintaining excellent service and profit levels
+ Managed a 7-person team of cooks and back of house staff and a team of 8 front house staff for a busy steakhouse restaurant
+ Continuously evaluated business operations to effectively align workflows for optimal area coverage increasing customer satisfaction rating by 80%

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
};

export { format };
