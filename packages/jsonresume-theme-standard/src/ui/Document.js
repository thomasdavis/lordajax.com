const Document = ({ body, styles }) => {
  return (
    <html>
      <head>
        {styles}

        <style
          dangerouslySetInnerHTML={{
            __html: `
            body {
                margin: 0;
                padding: 0;
            }
    
`,
          }}
        />
      </head>
      <body>{body}</body>
    </html>
  );
};

export default Document;
