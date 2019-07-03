/* eslint-disable no-param-reassign */
/* eslint-disable func-names */
const WebWorkerTemplatePlugin = require('webpack/lib/webworker/WebWorkerTemplatePlugin');
const SingleEntryPlugin = require('webpack/lib/SingleEntryPlugin');

module.exports = function () {};
module.exports.pitch = function (request) {
  if (!this.webpack) {
    throw new Error('Shared Worker Loader is only usable with webpack');
  }

  const callback = this.async();
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

  const compiler = this._compilation.createChildCompiler('sharedworker', output);

  new WebWorkerTemplatePlugin(output).apply(compiler);
  new SingleEntryPlugin(this.context, `!!${request}`, 'main').apply(compiler);

  if (this.options && this.options.worker && this.options.worker.plugins) {
    this.options.worker.plugins.forEach((plugin) => {
      compiler.apply(plugin);
    });
  }

  const subCache = `subcache ${__dirname} ${request}`;
  compiler.hooks.compilation.tap({ name: 'SharedWorkerLoader' }, (compilation) => {
    if (compilation.cache) {
      if (!compilation.cache[subCache]) { compilation.cache[subCache] = {}; }
      compilation.cache = compilation.cache[subCache];
    }
  });

  compiler.runAsChild((err, entries) => {
    if (err) return callback(err);

    if (entries[0]) {
      const file = entries[0].files[0];
      const factory = `new SharedWorker(__webpack_public_path__ + ${JSON.stringify(file)}, name)`;
      return callback(null, `module.exports = function(name) {\n  return ${factory};\n};`);
    }

    return callback(null, null);
  });
};
