module.exports = {
  reactStrictMode: true,
  transpilePackages: ['ui'],
  distDir: 'build',
  async rewrites() {
    return [
      {
        source: '/:payload',
        destination: '/api/:payload',
      },
      {
        source: '/:payload/interview',
        destination: '/interview',
      },
      {
        source: '/:payload/jobs',
        destination: '/jobs',
      },
    ];
  },
  compiler: {
    styledComponents: true,
  },
};
