const shell = require('shelljs');
const path = require('path');
const fs = require('fs');
const _ = require('lodash');
const dirHelper = require('../utils/directory');

const eventName = 'PrePush';

async function updateSearchableStack() {
  const gqlApiDirectory = dirHelper.getApiDirectory();
  const config = dirHelper.getConfig();
  console.log('>>proxy-es/index::', 'backendCfg', config); //TRACE
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
      _.set(searchableStack, `Resources.${key}.DependsOn`, [
        'ElasticSearchStreamingLambdaIAMRole',
      ]);
    }
  }

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

    context.print.info(`Event hhuhuhuu handler ${eventName} to be implemented.`);
  } catch (err) {
    context.print.error(err);
    throw err;
  }
}

module.exports = {
  run,
};
