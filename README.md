# 概要
SwaggerやRedocなどのAPI仕様書を、Cloudfront + S3で公開するためのリポジトリ。
また、Basic認証を入れるのによい方法があるか検証するためのもの

# 構成

-
|- cdk: インフラ構築
|- docs: swaggerのファイル配置


# 構築

1. AWSの構築
```
cd cdk
cdk deploy 
```
※ AWSのクリデンシャルはターミナルで適宜設定すること

2. redocのビルド

```
npx redocly build-docs docs/openapi.yaml -o dist/index.html
```

3. s3へのアップロード

```
 aws s3 sync ./ s3://作成したバケット名
```