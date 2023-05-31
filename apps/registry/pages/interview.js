import { Button } from 'ui';
import styled from 'styled-components';
import { useState } from 'react';

const Container = styled.div`
  height: 100vh;
  width: 100vw;
  background-color: #f5f5f5;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
`;

const Input = styled.input`
  position: absolute;
  bottom: 50px;
  width: 100%;
  height: 50px;
  border: none;
  border-radius: 5px;
  padding: 10px;
  font-size: 20px;
  box-sizing: border-box;
  outline: none;
  background-color: #fff;
  width: 600px;
  box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.1);
`;

const INTERVIEWER = 'interviewer';
const CANDIDATE = 'candidate';

export default function Talk() {
  const [text, setText] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [position, setPosition] = useState(INTERVIEWER);

  return (
    <Container>
      <Button />
      <Input />
    </Container>
  );
}
