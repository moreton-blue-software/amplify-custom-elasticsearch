const fs = require('fs');
const path = require('path');

const NEW_LINE_CHAR = `
`;

const P1 = '#set( $indexPath = "/',
  P2 = '/doc/_search" )';

module.exports = async function (resolversDirPath, prefix) {
  for (const resolverFile of fs.readdirSync(resolversDirPath)) {
    if (resolverFile.startsWith('Query.search') && resolverFile.endsWith('req.vtl')) {
      const resolverPath = path.join(resolversDirPath, resolverFile);
      const vtl = fs.readFileSync(resolverPath, { encoding: 'utf8' });
      const [firstLine, ...lines] = vtl.split(NEW_LINE_CHAR);
      let indexName = firstLine.trim().replace(P1, '');
      indexName = indexName.replace(P2, '');
      // console.log('>>searchable/update-search-resolvers::', 'firstLine', indexName); //TRACE
      if (indexName.startsWith(prefix)) continue;
      const multiTenantIndexName = prefix + indexName;
      const multiTenantIndexLine = P1 + multiTenantIndexName + P2;
      const newVtl = [multiTenantIndexLine, ...lines].join(NEW_LINE_CHAR);
      // console.log(
      //   '>>searchable/update-search-resolvers::',
      //   'multiTenantIndexName',
      //   newVtl,
      // ); //TRACE
      fs.writeFileSync(resolverPath, newVtl, { encoding: 'utf8' });
    }
  }
};
