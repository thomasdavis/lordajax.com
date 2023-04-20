const _ = require("lodash");
const axios = require("axios");
const express = require("express");
const resumeSchema = require("resume-schema");
const fs = require("fs");
const qr = require("qr-image");

const THEMES = { paper: require("jsonresume-theme-paper") };

const makeTemplate = (message) => {
  const template = fs.readFileSync(__dirname + "/template.html", "utf8");
  return template.replace("{MESSAGE}", message);
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

export default function handler(req, res) {
  console.log(req.body, req.param);
  const { theme, username } = req.query;

  const foundTheme = getTheme(theme);

  const rendered = {
    theme,
    username,
    foundTheme,
  };

  res.status(200).json(rendered);
}
