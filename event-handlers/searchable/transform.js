/* eslint-disable curly */
// const { } = require("shelljs");
const fs = require('fs');
const path = require('path');
const _ = require('lodash');

const ES_NODE_LAYER_ARN = config.ES_NODE_LAYER_ARN;
const ES_ENDPOINT = config.ES_ENDPOINT;
const ES_DOMAIN = config.ES_DOMAIN;
const ES_CODE = `
const { pushStream } = require("dynamodb-stream-elasticsearch");

const ES_ENDPOINT =
  "${ES_ENDPOINT}";

async function myHandler(event) {
  let opt;
  if (event.Records) opt = pushStream;

  try {
    await opt({
      // testMode: true,
      event,
      endpoint: ES_ENDPOINT,
      type: "doc",
    });
  } catch (e) {
    console.log(JSON.stringify(e));
    throw e;
  }
}

exports.handler = myHandler;
`;

async function updateStack(apiDirectory, config) {
  const ES_NODE_LAYER_ARN = config.esNodeLayerArn;
  const ES_ENDPOINT = config.esEndpoint;
  const ES_DOMAIN = config.esDomain;

  const gqlApiDirectory = gqlApiDirectory;
  const outSearchableStack = path.join(gqlApiDirectory, 'stacks', 'SearchableStack.json');
  if (fs.existsSync(outSearchableStack)) {
    console.warn('warning.. existing "Searchable Stack" found.');
  }
  console.log('>>proxy-es/index::', 'backendCfg', gqlApiDirectory); //TRACE
  // TODO: add check custom searchable stack
  // if(path.join(gqlApiDirectory,'stacks',''))
  const searchableStackPath = path.join(
    gqlApiDirectory,
    'build',
    'stacks',
    'SearchableStack.json',
  );
  const searchableStack = readJson(searchableStackPath);
  _.set(searchableStack, 'Parameters.GetAttGraphQLAPIApiId.Default', 'NONE');
  _.set(searchableStack, 'Conditions.AlwaysFalse', {
    'Fn::Equals': ['true', 'false'],
  });
  for (const key in searchableStack.Resources) {
    if (key === 'ElasticSearchStreamingLambdaIAMRole') {
      _.set(searchableStack, `Resources.${key}.Properties.RoleName`, {
        'Fn::Join': [
          '-',
          [
            {
              Ref: 'ElasticSearchStreamingIAMRoleName',
            },
            {
              Ref: 'AppSyncApiId',
            },
            {
              Ref: 'env',
            },
          ],
        ],
      });
      _.set(
        searchableStack,
        `Resources.${key}.Properties.Policies.0.PolicyDocument.Statement.0.Resource`,
        {
          'Fn::Sub': [
            `arn:aws:es:\${region}:\${account}:domain/${ES_DOMAIN}/*`,
            {
              region: {
                Ref: 'AWS::Region',
              },
              account: {
                Ref: 'AWS::AccountId',
              },
            },
          ],
        },
      );
    } else if (key === 'ElasticSearchStreamingLambdaFunction') {
      _.set(searchableStack, `Resources.${key}.Properties.FunctionName`, {
        'Fn::Join': [
          '-',
          [
            {
              Ref: 'ElasticSearchStreamingFunctionName',
            },
            {
              Ref: 'AppSyncApiId',
            },
            {
              Ref: 'env',
            },
          ],
        ],
      });
      _.set(searchableStack, `Resources.${key}.Properties.Runtime`, 'nodejs12.x');
      _.set(searchableStack, `Resources.${key}.Properties.Handler`, 'index.handler');
      _.set(searchableStack, `Resources.${key}.Properties.Code`, {
        ZipFile: ES_CODE,
      });
      _.set(searchableStack, `Resources.${key}.DependsOn`, [
        'ElasticSearchStreamingLambdaIAMRole',
      ]);
      _.set(searchableStack, `Resources.${key}.Properties.Layers`, [
        {
          'Fn::Sub': ES_NODE_LAYER_ARN,
        },
      ]);
      _.set(searchableStack, `Resources.${key}.Properties.Environment.Variables`, {
        ES_ENDPOINT,
      });
    }
    //remove other elasticsearch resources
    else if (key.startsWith('ElasticSearch')) delete searchableStack.Resources[key];
    //remove search resolvers
    else if (key.startsWith('Search') && key.endsWith('Resolver')) {
      delete searchableStack.Resources[key];
    }
    //update lambda mapping to map on custom es lambda
    else {
      // searchableStack.Resources[key].Properties.FunctionName = process.env.ES_LAMBDA_ARN;
      delete searchableStack.Resources[key].DependsOn;
    }
  }
  searchableStack.Outputs = {};
  fs.writeFileSync(
    path.join(gqlApiDirectory, 'stacks', 'SearchableStackCustom.json'),
    JSON.stringify(searchableStack, null, 2),
    { encoding: 'utf8' },
  );
  searchableStack.Resources = {
    EmptyResource: {
      Type: 'Custom::EmptyResource',
      Condition: 'AlwaysFalse',
    },
  };
  fs.writeFileSync(
    path.join(gqlApiDirectory, 'stacks', 'SearchableStack.json'),
    JSON.stringify(searchableStack, null, 2),
    { encoding: 'utf8' },
  );
}

async function setupFunctions() {
  // set param for esQuery
  const fnPath = path.join(
    amplifyDir,
    'backend',
    'function',
    config.ES_QUERY_NAME,
    'parameters.json',
  );
  console.log('>>proxy-es/pre-push::', 'outSearchableStack', fnPath); //TRACE
  const parameter = readJson(fnPath);
  console.log('>>proxy-es/pre-push::', 'parameter', parameter); //TRACE
  fs.writeFileSync(
    fnPath,
    JSON.stringify(
      {
        ...(parameter || {}),
        customEsEndpoint: ES_ENDPOINT,
      },
      null,
      2,
    ),
    { encoding: 'utf8' },
  );
  // readJson()
}

module.exports = {
  updateStack,
  setupFunctions,
};
