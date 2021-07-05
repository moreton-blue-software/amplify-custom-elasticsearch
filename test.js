// process.env.AWS_BRANCH = 'dev';

const shell = require('shelljs');
const _ = require('lodash');
const path = require('path');

shell.cd('../test-custom-es-plugin');

const context = {
  print: console,
};
_.set(context, 'parameters.options', {});
_.set(context, 'amplify.pathManager', {
  getBackendDirPath() {
    return path.join(shell.pwd().toString(), 'amplify/backend');
  },
});

require('./event-handlers/handle-PrePush').run(context);
