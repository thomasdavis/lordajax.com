module.exports = {
  reactStrictMode: true,
  transpilePackages: ["ui"],
  async rewrites() {
    return [
      {
        source: "/:username",
        destination: "/api/:username",
      },
    ];
  },
};
