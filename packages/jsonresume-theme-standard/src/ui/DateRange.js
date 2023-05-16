import styled from 'styled-components';
import Date from './Date';

const Text = styled.div`
  font-size: 16px;
  color: #666666;
`;

const Range = styled.div`
  display: flex;
`;

const DateRange = ({ startDate, endDate }) => {
  return (
    <Range>
      <Date date={startDate} />—
      <Date date={endDate} />
    </Range>
  );
};

export default DateRange;
