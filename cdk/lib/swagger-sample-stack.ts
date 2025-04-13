import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';

export class SwaggerSampleStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // S3バケットの作成
    const bucket = new s3.Bucket(this, 'OpenApiBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const lambdaEdgeRole = new iam.Role(this, 'LambdaEdgeRole', {
      assumedBy: new iam.CompositePrincipal(
        new iam.ServicePrincipal('lambda.amazonaws.com'),
        new iam.ServicePrincipal('edgelambda.amazonaws.com')
      ),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
      ]
    });
    
    // CloudWatch Logsアクセス用のマネージドポリシーを作成
    const cloudWatchLogsPolicy = new iam.ManagedPolicy(this, 'LambdaEdgeCloudWatchLogsPolicy', {
      statements: [
        new iam.PolicyStatement({
          actions: [
            'logs:CreateLogGroup',
            'logs:CreateLogStream',
            'logs:PutLogEvents'
          ],
          resources: ['arn:aws:logs:*:*:*']
        })
      ]
    });
    
    // SSMパラメータアクセス用のマネージドポリシーを作成
    const ssmParameterPolicy = new iam.ManagedPolicy(this, 'LambdaEdgeSSMParameterPolicy', {
      statements: [
        new iam.PolicyStatement({
          actions: ['ssm:GetParameter'],
          resources: [
            `arn:aws:ssm:us-east-1:${this.account}:parameter/openapi/auth-users`
          ]
        })
      ]
    });
    
    // マネージドポリシーをロールにアタッチ
    lambdaEdgeRole.addManagedPolicy(cloudWatchLogsPolicy);
    lambdaEdgeRole.addManagedPolicy(ssmParameterPolicy);

    // Basic認証用のLambda@Edge関数 - 明示的に作成したロールを使用
    const basicAuthFunction = new cloudfront.experimental.EdgeFunction(this, 'BasicAuthFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda-edge')),
      memorySize: 128,
      role: lambdaEdgeRole
    });
    
    // CloudFront OAI の作成
    const oai = new cloudfront.OriginAccessIdentity(this, 'OAI');
    
    // S3 バケットポリシーに OAI を追加
    bucket.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetObject'],
        resources: [bucket.arnForObjects('*')],
        principals: [new iam.CanonicalUserPrincipal(oai.cloudFrontOriginAccessIdentityS3CanonicalUserId)],
      })
    );
    
    // CloudFront ディストリビューション
    const distribution = new cloudfront.Distribution(this, 'OpenApiDistribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(bucket, { originAccessIdentity: oai }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        edgeLambdas: [
          {
            functionVersion: basicAuthFunction.currentVersion,
            eventType: cloudfront.LambdaEdgeEventType.VIEWER_REQUEST, // ORIGIN_REQUESTから変更
            includeBody: false
          },
        ],
      },
      defaultRootObject: 'index.html',
    });

    // 出力
    new cdk.CfnOutput(this, 'BucketName', {
      value: bucket.bucketName,
      description: 'The name of the S3 bucket',
      exportName: 'OpenApiBucketName',
    });

    new cdk.CfnOutput(this, 'DistributionId', {
      value: distribution.distributionId,
      description: 'The ID of the CloudFront distribution',
      exportName: 'OpenApiDistributionId',
    });

    new cdk.CfnOutput(this, 'DistributionUrl', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'The URL of the CloudFront distribution',
      exportName: 'OpenApiDistributionUrl',
    });
  }
}