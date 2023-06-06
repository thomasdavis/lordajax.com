import { Button } from 'ui';
import styled from 'styled-components';
import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import { faker } from '@faker-js/faker';
import { v4 as uuidv4 } from 'uuid';

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
  display: flex;
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

const INTERVIEWER = 'interviewer';
const CANDIDATE = 'candidate';

const interviewId = 'axyz';

export default function Talk() {
  const router = useRouter();
  const parts = router.asPath.split('/');
  const username = parts[1];
  console.log({ username });
  const [text, setText] = useState('');
  const [reply, setReply] = useState('');
  const [replying, setReplying] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [error, setError] = useState(null);
  const [position, setPosition] = useState(CANDIDATE);
  const initialMessage =
    position === CANDIDATE
      ? {
          position: INTERVIEWER,
          content: 'Hello, I am here to interview you',
        }
      : { position: CANDIDATE, content: 'Hi, I am ready to be interviewed' };
  const [messages, setMessages] = useState([initialMessage]);

  const bottomRef = useRef(null);
  const textInput = useRef(null);

  const togglePosition = () => {
    setMessages([initialMessage]);
    setPosition(position === INTERVIEWER ? CANDIDATE : INTERVIEWER);
  };

  const postMessage = async () => {
    setReplying(true);
    console.log('what is the value of text', text);
    // const message = {
    //   id: uuidv4(),
    //   content: faker.lorem.lines({ min: 1, max: 10 }),
    // };
    // setMessages([...messages, message]);
    const prompt = text;

    const response = await fetch('/api/interview', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username,
        prompt,
        position,
        messages: messages.slice(-6),
      }),
    });

    if (!response.ok) {
      throw new Error(response.statusText);
    }

    // This data is a ReadableStream
    const data = response.body;
    if (!data) {
      return;
    }

    const reader = data.getReader();
    const decoder = new TextDecoder();
    let done = false;

    let reply = '';
    while (!done) {
      const { value, done: doneReading } = await reader.read();
      done = doneReading;
      const chunkValue = decoder.decode(value);
      reply = reply + chunkValue;
      setReply(reply);
    }
    console.log('set reply');
    console.log({ reply });
    console.log('sdasdasda', { messages });

    setReplying(false);
  };

  useEffect(() => {
    if (replying !== null && reply !== '') {
      setMessages([
        ...messages,
        {
          id: uuidv4(),
          content: reply,
          position: position === INTERVIEWER ? CANDIDATE : INTERVIEWER,
        },
      ]);
      setReply('');
      textInput?.current?.focus();
    }
  }, [replying]);

  console.log({ messages });

  const handleInputChange = (ev) => {
    setText(ev.target.value);
  };

  const handleInputKeyPress = (ev) => {
    if (ev.key === 'Enter') {
      console.log('do validate');
      setMessages([
        ...messages,
        {
          id: uuidv4(),
          content: ev.target.value,
          position,
        },
      ]);
      postMessage();
      setText('');
    }
  };

  const onShowAbout = () => {
    console.log('show about');
    // toggle showAbout
    setShowAbout(!showAbout);
  };

  console.log({ showAbout });

  useEffect(() => {
    // 👇️ simulate chat messages flowing in
    // setInterval(
    // () =>
    // setMessages((current) => {
    //   const message = {
    //     id: uuidv4(),
    //     content: faker.lorem.lines({ min: 1, max: 10 }),
    //   };
    //   console.log({ current });
    //   return [...current, message];
    // });
    // );
  }, []);

  useEffect(() => {
    // 👇️ scroll to bottom every time messages change
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <>
      {' '}
      {showAbout && (
        <About>
          <AboutContainer>
            <p>Hi there, this is just a bit of fun for now.</p>
            <p>
              It uses OpenAI GPT-3, and creates a prompt that is made up of;
            </p>
            <ul>
              <li>A preconfigured personality for the interview/er/ee</li>
              <li>The hosted resume.json based off the url</li>
              <li>The last 6-8 messages of your conversation so far</li>
            </ul>
            <p>
              You can use any resume that is hosted on the registry, see this{' '}
              <a
                target="__blank"
                href="https://registry.jsonresume.org/resumes"
              >
                list of resumes
              </a>
            </p>
            <Close onClick={onShowAbout}>Close</Close>
          </AboutContainer>
        </About>
      )}
      {!showAbout && (
        <>
          <Container>
            <Header>
              <HeaderContainer>
                <Logo href="https://jsonresume.org" target="__blank">
                  JSON Resume
                </Logo>
                <AboutLink onClick={onShowAbout}>About</AboutLink>
              </HeaderContainer>
            </Header>

            <Switch>
              <Option
                active={position === INTERVIEWER}
                onClick={togglePosition}
              >
                Interviewer
              </Option>
              <Option active={position === CANDIDATE} onClick={togglePosition}>
                Candidate
              </Option>
            </Switch>
            <MessagesContainer>
              <Messages>
                {messages.map((message) => {
                  return (
                    <Message key={message.id}>
                      <Name>{capitalizeFirstLetter(message.position)}:</Name>{' '}
                      {message.content}
                    </Message>
                  );
                })}
                {replying && (
                  <Message key="replying">
                    <Name>
                      {capitalizeFirstLetter(
                        position === INTERVIEWER ? CANDIDATE : INTERVIEWER
                      )}
                      :
                    </Name>{' '}
                    {reply}
                  </Message>
                )}
                <div ref={bottomRef} />
              </Messages>
            </MessagesContainer>
            <InputContainer>
              {position === INTERVIEWER && (
                <Helper>
                  You are currentlying interviewing&nbsp;
                  <a href={`https://registry.jsonresume.org/${username}`}>
                    {username}
                  </a>
                </Helper>
              )}
              {position === CANDIDATE && (
                <Helper>
                  You are being interviewed as&nbsp;
                  <a
                    target="__blank"
                    href={`https://registry.jsonresume.org/${username}`}
                  >
                    {username}
                  </a>
                </Helper>
              )}
              <Input
                placeholder="Write here..."
                autoFocus
                onChange={handleInputChange}
                onKeyPress={handleInputKeyPress}
                disabled={replying}
                value={replying ? 'Thinking...' : text}
                ref={textInput}
              />
            </InputContainer>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link
              rel="preconnect"
              href="https://fonts.gstatic.com"
              crossorigin
            />
            <link
              href="https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,300;1,400;1,500;1,600;1,700;1,800&display=swap"
              rel="stylesheet"
            />
          </Container>
        </>
      )}
      <style jsx global>{`
        body {
          margin: 0px;
          padding: 0px;
          background-color: #f5f5f5;
          font-family: 'Open Sans', sans-serif;
        }
      `}</style>
    </>
  );
}
