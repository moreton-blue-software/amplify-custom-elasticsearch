# amplify-custom-elasticsearch
Amplify custom elasticsearch plugin

### Usage:

On your amplify project directory,
```
1. yarn add amplify-custom-elasticsearch -D
2. create `amplify-custom-elasticsearch.json` on the root folder.
3. run amplify push
```

### Configuration file: `amplify-custom-elasticsearch.json`
Put all amplify environment details under `env`
```
{
  "env": {
    "dev*": {
      "esDomainArn": "<ES_DOMAIN_ARN>",
      "esDomainEndpoint": "<ES_DOMAIN_ENDPOINT>"
    }
  }
}
```
