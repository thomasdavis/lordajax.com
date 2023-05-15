import styled from 'styled-components';
import SubTitle from './SubTitle';
import List from './List';
import DateRange from './DateRange';

const Company = styled.div`
  font-size: 24px;
  color: #004400;
`;

const Work = ({ work }) => {
  return (
    <div>
      <SubTitle>Professional Experience</SubTitle>
      {work.map((w) => {
        return (
          <div>
            <Company>{w.name}</Company>
            <DateRange startDate={w.startDate} endDate={w.endDate} />
            <p>{w.summary}</p>
            <List items={w.highlights} />
          </div>
        );
      })}
    </div>
  );
};

export default Work;
