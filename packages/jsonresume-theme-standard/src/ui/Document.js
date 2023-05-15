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
                font-family: 'Open Sans', sans-serif;
            }
            `,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
        <link
          href="https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,300;1,400;1,500;1,600;1,700;1,800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{body}</body>
    </html>
  );
};

export default Document;
