const fs = require('fs');
const _ = require('lodash');
const path = require('path');

const cwd = process.cwd();

const amplifyDir = path.join(cwd, 'amplify');

let apiName, apiDir, config;

function readJson(...args) {
  return JSON.parse(fs.readFileSync(path.join(...args), 'utf8'));
}

function getConfig() {
  const amplifyEnv = getEnv();
  if (!config) {
    let rawConfig;
    try {
      rawConfig = readJson('amplify-custom-elasticsearch.json');
    } catch (err) {
      return;
    }
    let envConfig = {};
    for (const envKey in rawConfig.env) {
      const pattern = new RegExp(envKey);
      if (pattern.test(amplifyEnv)) envConfig = rawConfig.env[envKey];
    }
    if (envConfig.esDomainArn) envConfig.esRegion = envConfig.esDomainArn.split(':')[3];

    if (!_.isEmpty(envConfig)) config = { ...envConfig };
  }

  return config;
}

function getApiName() {
  if (!apiName) throw new Error('No ApiName found');
  return apiName;
}

function getEnv() {
  let ampEnv = process.env.AWS_BRANCH || process.env.USER_BRANCH;
  if (!ampEnv) {
    const localEnvJson = readJson(amplifyDir, '.config', 'local-env-info.json');
    ampEnv = localEnvJson.envName;
  }
  return ampEnv;
}

function getApiDirectory() {
  if (!apiDir) {
    const backendCfg = readJson(amplifyDir, 'backend', 'backend-config.json');

    let gqlApiName;
    for (const key in backendCfg.api) {
      if (_.get(backendCfg, ['api', key, 'service']) === 'AppSync') {
        gqlApiName = key;
        break;
      }
    }
    console.log('>>proxy-es/index::', 'gqlApiName', gqlApiName); //TRACE
    if (!gqlApiName) throw new Error('Cannot find API');
    apiName = gqlApiName;
    apiDir = path.join(amplifyDir, 'backend', 'api', gqlApiName);
  }

  return apiDir;
}

function getResolverVtl(typeName, fieldName, type) {
  const filePath = path.join(
    getApiDirectory(),
    'build',
    'resolvers',
    `${typeName}.${fieldName}.${type}.vtl`,
  );
  const txt = fs.readFileSync(filePath, 'utf-8');
  return txt;
}

function getResResolverVtl(typeName, fieldName) {
  return getResolverVtl(typeName, fieldName, 'res');
}

function getReqResolverVtl(typeName, fieldName) {
  return getResolverVtl(typeName, fieldName, 'req');
}

function getAwsExports() {
  // eslint-disable-next-line no-undef
  const filePath = path.join(__dirname, '..', '..', '..', 'src', 'aws-exports.js');
  const txt = fs.readFileSync(filePath, 'utf8');
  const pre = 'const awsmobile = {',
    post = '};';
  const s = txt.indexOf(pre);
  const e = txt.lastIndexOf(post);
  const inner = txt.substring(s + pre.length, e);
  if (inner.length < 1) throw new Error('failed to get aws-exports');
  const json = `{${inner}}`;
  return JSON.parse(json);
}

// eslint-disable-next-line no-undef
module.exports = {
  readJson,
  amplifyDir,
  getEnv,
  getConfig,
  getApiName,
  getApiDirectory,
  getAwsExports,
  getReqResolverVtl,
  getResResolverVtl,
};
