const THEMES = { paper: require("jsonresume-theme-paper") };

const getTheme = (theme) => {
  try {
    return THEMES[theme];
  } catch (e) {
    return {
      e: e.toString(),
      error: "Theme is not supported.",
    };
  }
};

const format = async function (resume, options) {
  const themeRenderer = getTheme(options.theme);
  const resumeHTML = themeRenderer.render(resume);
  return resumeHTML;
};

export { format };
