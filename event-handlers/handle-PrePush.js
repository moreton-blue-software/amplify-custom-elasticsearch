const shell = require('shelljs');
const path = require('path');
const fs = require('fs');
const _ = require('lodash');
const dirHelper = require('../utils/directory');
const archiveLambdaStreaming = require('./searchable/archive-lambda-streaming');
const updateSearchResolvers = require('./searchable/update-search-resolvers');

const eventName = 'PrePush';
const streamingLambdaFunctionZipName = 'ElasticSearchStreamingLambdaFunctionMulti.zip';

async function updateSearchableStack() {
  const gqlApiDirectory = dirHelper.getApiDirectory();
  const config = dirHelper.getConfig();

  const apiName = dirHelper.getApiName();
  const amplifyEnv = dirHelper.getEnv();

  const esIndexPrefix = `${apiName}-${amplifyEnv}-`;
  // console.log('>>proxy-es/index::', 'backendCfg', config, apiName, amplifyEnv); //TRACE
  // TODO: add check custom searchable stack
  // if(path.join(gqlApiDirectory,'stacks',''))
  const searchableStackPath = path.join(
    gqlApiDirectory,
    'build',
    'stacks',
    'SearchableStack.json',
  );
  const searchableStack = dirHelper.readJson(searchableStackPath);
  _.set(searchableStack, 'Parameters.GetAttGraphQLAPIApiId.Default', 'NONE');
  _.set(searchableStack, 'Conditions.AlwaysFalse', {
    'Fn::Equals': ['true', 'false'],
  });
  _.set(searchableStack, 'Outputs.ElasticsearchDomainArn.Value', config.esDomainArn);
  _.set(
    searchableStack,
    'Outputs.ElasticsearchDomainEndpoint.Value',
    config.esDomainEndpoint,
  );
  for (const key in searchableStack.Resources) {
    if (
      ['ElasticSearchAccessIAMRole', 'ElasticSearchStreamingLambdaIAMRole'].includes(key)
    ) {
      _.set(
        searchableStack,
        `Resources.${key}.Properties.Policies.0.PolicyDocument.Statement.0.Resource`,
        `${config.esDomainArn}/*`,
      );
    } else if (key === 'ElasticSearchDataSource') {
      _.set(
        searchableStack,
        `Resources.${key}.Properties.ElasticsearchConfig.AwsRegion`,
        config.esRegion,
      );
      _.set(
        searchableStack,
        `Resources.${key}.Properties.ElasticsearchConfig.Endpoint`,
        config.esDomainEndpoint,
      );
      _.set(searchableStack, `Resources.${key}.DependsOn`, undefined);
    } else if (key === 'ElasticSearchDomain') {
      _.set(searchableStack, `Resources.${key}`, undefined);
    } else if (key === 'ElasticSearchStreamingLambdaFunction') {
      _.set(
        searchableStack,
        `Resources.${key}.Properties.Environment.Variables.ES_ENDPOINT`,
        config.esDomainEndpoint,
      );
      _.set(
        searchableStack,
        `Resources.${key}.Properties.Environment.Variables.ES_REGION`,
        config.esRegion,
      );
      _.set(
        searchableStack,
        `Resources.${key}.Properties.Environment.Variables.ES_INDEX_PREFIX`,
        esIndexPrefix,
      );
      _.set(searchableStack, `Resources.${key}.Properties.Code.S3Key`, {
        'Fn::Join': [
          '/',
          [
            {
              Ref: 'S3DeploymentRootKey',
            },
            'functions',
            streamingLambdaFunctionZipName,
          ],
        ],
      });
      _.set(searchableStack, `Resources.${key}.DependsOn`, [
        'ElasticSearchStreamingLambdaIAMRole',
      ]);
    }
  }

  await archiveLambdaStreaming(
    path.join(gqlApiDirectory, 'build', 'functions', streamingLambdaFunctionZipName),
  );
  await updateSearchResolvers(
    path.join(gqlApiDirectory, 'build', 'resolvers'),
    esIndexPrefix,
  );

  fs.writeFileSync(
    // `${searchableStackPath}.n.json`,
    searchableStackPath,
    JSON.stringify(searchableStack, null, 2),
  );
}

async function run(context) {
  try {
    context.parameters.options['no-gql-override'] = true; // prevent any changes to be overwritten

    context.print.info('Building api files');
    shell.exec('amplify api gql-compile');
    context.print.info('Done building api files');

    // const { amplify } = context;
    // const targetDir = amplify.pathManager.getBackendDirPath();
    // const backendConfigPath = path.join(targetDir, 'backend-config.json');
    // const backendConfig = JSON.parse(shell.cat(backendConfigPath).toString());
    // context.print.info(targetDir);

    await updateSearchableStack();

    context.print.info('Custom amplify elasticsearch connection configured');
  } catch (err) {
    context.print.error(err);
    throw err;
  }
}

module.exports = {
  run,
};
