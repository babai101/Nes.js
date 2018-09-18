const path = require('path');
const UglifyJsPlugin = require('uglifyjs-webpack-plugin');

module.exports = {
  entry: './public/js/nes.js',
  output: {
    filename: 'nes-emu.js',
    path: path.resolve(__dirname, 'public/build')
  },
  optimization: {
    // compress: true,
    minimize: true,
    minimizer: [
      new UglifyJsPlugin({
        include: /\.js$/
      })
    ]
  }
  // optimization: {
  //   minimize: true,
  //   minimizer: [
  //     new UglifyJsPlugin({
  //       include: /\.js$/
  //     })
  //   ],
  //   compress: true
  // }
};
