/* eslint-disable no-param-reassign */
/* eslint-disable func-names */
const WebWorkerTemplatePlugin = require('webpack/lib/webworker/WebWorkerTemplatePlugin');
const SingleEntryPlugin = require('webpack/lib/SingleEntryPlugin');
const path = require('path');

const loaderUtils = require('loader-utils');

module.exports = function () {};
module.exports.pitch = function (request) {
  if (!this.webpack) {
    throw new Error('Only usable with webpack');
  }

  const callback = this.async();
  const query = loaderUtils.parseQuery(this.query);
  const output = {
    filename: '[hash].sharedworker.js',
    chunkFilename: '[id].[hash].sharedworker.js',
    namedChunkFilename: null,
  };

  if (this.options && this.options.worker && this.options.worker.output) {
    for (const name in this.options.worker.output) {
      output[name] = this.options.worker.output[name];
    }
  }

  const workerCompiler = this._compilation.createChildCompiler('sharedworker', output);

  workerCompiler.apply(new WebWorkerTemplatePlugin(output));
  workerCompiler.apply(new SingleEntryPlugin(this.context, `!!${request}`, 'main'));

  if (this.options && this.options.worker && this.options.worker.plugins) {
    this.options.worker.plugins.forEach((plugin) => {
      workerCompiler.apply(plugin);
    });
  }

  const subCache = `subcache ${__dirname} ${request}`;
  workerCompiler.plugin('compilation', (compilation) => {
    if (compilation.cache) {
      if (!compilation.cache[subCache]) {
        compilation.cache[subCache] = {};
      }
      compilation.cache = compilation.cache[subCache];
    }
  });

  workerCompiler.runAsChild((err, entries, compilation) => {
    if (err) return callback(err);
    if (entries[0]) {
      const workerFile = entries[0].files[0];
      let constructor = `new SharedWorker(__webpack_public_path__ + ${JSON.stringify(workerFile)}, name)`;
      if (query.inline) {
        constructor = `require(${JSON.stringify(`!!${path.join(__dirname, 'createInlineWorker.js')}`)})(${
          JSON.stringify(compilation.assets[workerFile].source())}, __webpack_public_path__ + ${JSON.stringify(workerFile)}, name)`;
      }
      return callback(null, `module.exports = function(name) {\n\treturn ${constructor};\n};`);
    }
    return callback(null, null);
  });
};
