import styled from 'styled-components';

const Text = styled.div`
  font-size: 26px;
  color: #330000;
`;

const SubTitle = ({ children }) => {
  return <Text>{children}</Text>;
};

export default SubTitle;
