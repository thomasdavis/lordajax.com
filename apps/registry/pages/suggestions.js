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

export default function Talk() {
  const router = useRouter();
  const parts = router.asPath.split('/');
  const username = parts[1];

  const [suggestions, setSuggestions] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.post('/api/suggestions', {
          username,
        });
        setSuggestions(response.data);
      } catch (error) {
        console.error('Error fetching data: ', error);
      }
    };

    fetchData();
  }, []);

  return (
    <Layout>
      {!suggestions && <div>Loading...</div>}
      {suggestions && (
        <pre
          style={{
            'white-space': 'pre-wrap',
            width: '60%',
            margin: 'auto',
            'margin-top': '100px',
          }}
        >
          {suggestions}
        </pre>
      )}
    </Layout>
  );
}
