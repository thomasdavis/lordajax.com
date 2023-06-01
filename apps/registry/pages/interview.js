import { Button } from "ui";
import styled from "styled-components";
import { useEffect, useRef, useState } from "react";
import { faker } from "@faker-js/faker";
import { v4 as uuidv4 } from "uuid";
const Container = styled.div`
  height: 100vh;
  width: 100vw;
  background-color: #f5f5f5;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
`;

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

const InputContainer = styled.div`
  position: fixed;
  background: #444;
  bottom: 0;
  left: 0;
  width: 100vw;
  height: 150px;
  display: flex;
  justify-content: center;
`;

const Input = styled.input`
  position: fixed;
  bottom: 50px;
  height: 50px;
  border: none;
  border-radius: 5px;
  padding: 10px;
  font-size: 20px;
  box-sizing: border-box;
  outline: none;
  background-color: #fff;
  width: 100%;
  max-width: 600px;
  box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.1);
`;

// switch is fixed to the center top
const Switch = styled.div`
  position: fixed;
  top: 20px;
  width: 300px;
  height: 30px;
  display: flex;
  justify-content: center;
  align-items: center;
`;

const Option = styled.div`
  background-color: ${(props) => (props.active ? "#333" : "#999")};
  width: 140px;
  cursor: pointer;
  height: 30px;

  display: flex;
  justify-content: center;
  align-items: center;
  text-transform: uppercase;
  color: ${(props) => (props.active ? "#888" : "#222")};
  &:hover {
    background-color: #f76000;
  }
`;

const MessagesContainer = styled.div`
  background: orange;
  max-width: 600px;
  width: 100%;
  height: calc(100vh - 200px);
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

const INTERVIEWER = "interviewer";
const CANDIDATE = "candidate";

const interviewId = "axyz";

export default function Talk() {
  const [text, setText] = useState("");
  const [messages, setMessages] = useState([]);
  const [reply, setReply] = useState("");
  const [replying, setReplying] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [position, setPosition] = useState(CANDIDATE);

  const bottomRef = useRef(null);

  const togglePosition = () => {
    setPosition(position === INTERVIEWER ? CANDIDATE : INTERVIEWER);
  };

  const postMessage = async () => {
    setReplying(true);
    console.log("what is the value of text", text);
    // const message = {
    //   id: uuidv4(),
    //   content: faker.lorem.lines({ min: 1, max: 10 }),
    // };
    // setMessages([...messages, message]);
    const prompt = text;

    const response = await fetch("/api/interview", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        position,
        messages: messages.slice(-4),
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

    let reply = "";
    while (!done) {
      const { value, done: doneReading } = await reader.read();
      done = doneReading;
      const chunkValue = decoder.decode(value);
      reply = reply + chunkValue;
      setReply(reply);
    }
    console.log("set reply");
    console.log({ reply });
    console.log("sdasdasda", { messages });

    setReplying(false);
  };

  useEffect(() => {
    if (replying !== null && reply !== "") {
      setMessages([
        ...messages,
        {
          id: uuidv4(),
          content: reply,
          position: position === INTERVIEWER ? CANDIDATE : INTERVIEWER,
        },
      ]);
      setReply("");
    }
  }, [replying]);

  console.log({ messages });

  const handleInputChange = (ev) => {
    setText(ev.target.value);
  };

  const handleInputKeyPress = (ev) => {
    if (ev.key === "Enter") {
      console.log("do validate");
      setMessages([
        ...messages,
        {
          id: uuidv4(),
          content: ev.target.value,
          position,
        },
      ]);
      postMessage();
      setText("");
    }
  };

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
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <Container>
      <Switch>
        <Option active={position === INTERVIEWER} onClick={togglePosition}>
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
                <Name>{capitalizeFirstLetter(message.position)}:</Name>{" "}
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
              </Name>{" "}
              {reply}
            </Message>
          )}
          <div ref={bottomRef} />
        </Messages>
      </MessagesContainer>
      <InputContainer>
        <Input
          onChange={handleInputChange}
          onKeyPress={handleInputKeyPress}
          disabled={replying}
          value={text}
        />
      </InputContainer>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
      <link
        href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;1,100;1,200;1,300;1,400;1,500;1,600;1,700&display=swap"
        rel="stylesheet"
      />
      <style jsx global>{`
        body {
          margin: 0px;
          padding: 0px;
          font-family: "IBM Plex Sans", sans-serif;
        }
      `}</style>
    </Container>
  );
}
