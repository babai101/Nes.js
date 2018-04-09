const path = require('path');

module.exports = {
  entry: './public/js/index.js',
  output: {
    filename: 'nes-emu.js',
    path: path.resolve(__dirname, 'public/build')
  }
};
