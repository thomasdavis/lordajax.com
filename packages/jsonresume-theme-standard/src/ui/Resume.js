import styled from 'styled-components';
import Basics from './Basics';
import Work from './Work';

const Layout = styled.div`
  max-width: 660px;
  margin: 0 auto;
  background: #ebebeb;
`;

const Resume = ({ resume }) => {
  return (
    <Layout>
      <Basics basics={resume.basics} />
      <Work work={resume.work} />
    </Layout>
  );
};

export default Resume;
