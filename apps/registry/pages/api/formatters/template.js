const THEMES = {
  ace: require("jsonresume-theme-ace"),
  actual: require("jsonresume-theme-actual"),
  apage: require("jsonresume-theme-apage"),
  autumn: require("jsonresume-theme-autumn"),
  caffeine: require("jsonresume-theme-caffeine"),
  class: require("jsonresume-theme-class"),
  classy: require("jsonresume-theme-classy"),
  cora: require("jsonresume-theme-cora"),
  dave: require("jsonresume-theme-dave"),
  elegant: require("jsonresume-theme-elegant"),
  elite: require("jsonresume-theme-elite"),
  eloquent: require("jsonresume-theme-eloquent"),
  "el-santo": require("jsonresume-theme-el-santo"),
  even: require("jsonresume-theme-even"),
  flat: require("jsonresume-theme-flat"),
  "flat-fr": require("jsonresume-theme-flat-fr"),
  full: require("jsonresume-theme-full"),
  github: require("jsonresume-theme-github"),
  jacrys: require("jsonresume-theme-jacrys"),
  kards: require("jsonresume-theme-kards"),
  keloran: require("jsonresume-theme-keloran"),
  kendall: require("jsonresume-theme-kendall"),
  macchiato: require("jsonresume-theme-macchiato"),
  mantra: require("jsonresume-theme-mantra"),
  "mocha-responsive": require("jsonresume-theme-mocha-responsive"),
  modern: require("jsonresume-theme-modern"),
  msresume: require("jsonresume-theme-msresume"),
  one: require("jsonresume-theme-one"),
  onepage: require("jsonresume-theme-onepage"),
  onepageresume: require("jsonresume-theme-onepageresume"),
  orbit: require("jsonresume-theme-orbit"),
  paper: require("jsonresume-theme-paper"),
  "paper-plus-plus": require("jsonresume-theme-paper-plus-plus"),
  papirus: require("jsonresume-theme-papirus"),
  pumpkin: require("jsonresume-theme-pumpkin"),
  rocketspacer: require("jsonresume-theme-rocketspacer"),
  short: require("jsonresume-theme-short"),
  "simple-red": require("jsonresume-theme-simple-red"),
  slick: require("jsonresume-theme-slick"),
  spartan: require("jsonresume-theme-spartan"),
  srt: require("jsonresume-theme-srt"),
  stackoverflowed: require("jsonresume-theme-stackoverflowed"),
  stackoverflow: require("jsonresume-theme-stackoverflow"),
  "standard-resume": require("jsonresume-theme-standard-resume"),
  "tachyons-clean": require("jsonresume-theme-tachyons-clean"),
  "tan-responsive": require("jsonresume-theme-tan-responsive"),
  techlead: require("jsonresume-theme-techlead"),
  verbum: require("jsonresume-theme-verbum"),
  wraypro: require("jsonresume-theme-wraypro"),
};

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
  const theme = options.theme ?? "elegant";
  const themeRenderer = getTheme(theme);
  const resumeHTML = themeRenderer.render(resume);
  return resumeHTML;
};

export { format };