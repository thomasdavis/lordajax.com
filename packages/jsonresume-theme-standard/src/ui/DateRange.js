import styled from 'styled-components';
import Date from './Date';

const Text = styled.div`
  font-size: 16px;
  color: #666666;
`;

const DateRange = ({ startDate, endDate }) => {
  return (
    <>
      <Date date={startDate} /> - <Date date={endDate} />
    </>
  );
};

export default DateRange;
