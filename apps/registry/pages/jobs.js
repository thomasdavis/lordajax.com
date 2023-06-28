import { Button } from 'ui';
import styled from 'styled-components';
import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import { faker } from '@faker-js/faker';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { NodeHtmlMarkdown, NodeHtmlMarkdownOptions } from 'node-html-markdown';
import ReactMarkdown from 'react-markdown';
import Layout from '../ui/Layout';
const Container = styled.div`
  height: 100vh;
  width: 100vw;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
`;

const HeaderContainer = styled.div`
  max-width: 600px;
  margin: auto;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding: 0 15px;
  height: 100%;
`;

const Header = styled.div`
  background: #fff18f;
  position: fixed;
  left: 0;
  top: 0;
  width: 100vw;
  height: 40px;
  font-weight: 500;
`;

const Logo = styled.a`
  text-decoration: none;
  color: #000;
  &:active {
    color: #000;
  }
  &:visited {
    color: #000;
  }

  &:hover {
    color: #df4848;
  }
`;
const AboutLink = styled.div`
  cursor: pointer;

  &:hover {
    color: #df4848;
  }
`;
const AboutContainer = styled.div`
  max-width: 400px;
  text-align: left;
  margin: 0 20px;
`;
const About = styled.div`
  position: fixed;
  width: 100vw;
  height: 100vh;
  background: #fff;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 18px;
  flex-direction: column;

  & p {
    margin-bottom: 15px;
`;

const Close = styled.div`
  background-color: #df4848;
  width: 140px;
  cursor: pointer;
  height: 30px;

  display: flex;
  justify-content: center;
  align-items: center;
  color: #fbfbfb;
  &:hover {
    background-color: #ea8989;
  }
  border-radius: 5px;
`;

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

const InputContainer = styled.div`
  position: fixed;
  background: #fff18f;
  bottom: 0;
  left: 0;
  width: 100vw;
  height: 120px;
  display: flex;
  justify-content: center;
  flex-direction: column;
  align-items: center;
`;

const Input = styled.input`
  bottom: 50px;
  height: 50px;
  border: none;
  border-radius: 5px;
  padding: 20px;
  font-size: 20px;
  box-sizing: border-box;
  outline: none;
  background-color: #fff;
  width: 100%;
  max-width: 570px;
  margin: 0 30px;
  box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.1);
  &:disabled {
    background-color: #f5f5f5;
  }
`;

// switch is fixed to the center top
const Switch = styled.div`
  position: fixed;
  top: 50px;
  width: 300px;
  height: 30px;
  display: flex;
  justify-content: center;
  align-items: center;
`;

const Option = styled.div`
  background-color: ${(props) => (props.active ? '#df4848' : '#999')};
  width: 140px;
  cursor: pointer;
  height: 30px;

  display: flex;
  justify-content: center;
  align-items: center;
  color: ${(props) => (props.active ? '#fbfbfb' : '#222')};
  &:hover {
    background-color: #ea8989;
  }

  &:first-child {
    border-radius: 5px 0px 0px 5px;
  }
  &:last-child {
    border-radius: 0px 5px 5px 0px;
  }
`;

const MessagesContainer = styled.div`
  background: #fbfbfb;
  max-width: 600px;
  padding: 90px 30px;
  width: 100%;
  height: calc(100vh - 170px);
`;

const Messages = styled.div`
  background: yellow;
  background: #fbfbfb;
  padding-bottom: 200px;
`;
const Message = styled.div`
  background: blue;
  background: #fbfbfb;
  padding: 0 20px;
  margin-bottom: 10px;
`;

const Name = styled.span`
  font-weight: 600;
  flex: 0 0 100px;
  display: inline-block;
  text-align: right;
  margin-right: 5px;
`;

const Helper = styled.div`
  font-size: 13px;
  margin-bottom: 15px;
  & a {
    text-decoration: none;
    font-weight: 600;
  }
  & a:hover {
    text-decoration: underline;
    color: #df4848;
  }
  & a:visited {
    color: #000;
  }
`;

export default function Talk() {
  const router = useRouter();
  const parts = router.asPath.split('/');
  const username = parts[1];

  const [jobs, setJobs] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.post('/api/jobs', {
          username,
        });
        setJobs(response.data);
      } catch (error) {
        console.error('Error fetching data: ', error);
      }
    };

    fetchData();
  }, []);

  return (
    <Layout>
      <MessagesContainer>
        <Messages>
          {jobs &&
            jobs.map((job) => {
              let content = job.content.replace('<code>', '');
              content = job.content.replace('</code>', '');
              content = job.content.replace('<pre>', '');
              content = job.content.replace('</pre>', '');
              return (
                <Message key={job.uuid}>
                  <Name>{capitalizeFirstLetter(job.type)}</Name>
                  <ReactMarkdown>
                    {NodeHtmlMarkdown.translate(content).replace('```', '')}
                  </ReactMarkdown>
                </Message>
              );
            })}
        </Messages>
      </MessagesContainer>
    </Layout>
  );
}
