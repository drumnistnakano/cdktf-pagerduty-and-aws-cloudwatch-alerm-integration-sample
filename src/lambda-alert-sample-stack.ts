import {
  cloudwatchLogGroup,
  cloudwatchLogMetricFilter,
  cloudwatchMetricAlarm,
  iamRole,
  iamRolePolicyAttachment,
  lambdaFunction,
  provider,
  s3Bucket,
  s3Object,
  snsTopic,
  snsTopicSubscription,
} from '@cdktf/provider-aws'
import { ServiceIntegration } from '@cdktf/provider-pagerduty/lib/service-integration'
import { AssetType, TerraformAsset, TerraformStack } from 'cdktf'
import { Construct } from 'constructs'
import * as path from 'path'

interface LambdaFunctionConfig {
  path: string
  handler: string
  runtime: string
  stageName: string
  version: string
  integration: ServiceIntegration
}

const lambdaRolePolicy = {
  Version: '2012-10-17',
  Statement: [
    {
      Action: 'sts:AssumeRole',
      Principal: {
        Service: 'lambda.amazonaws.com',
      },
      Effect: 'Allow',
      Sid: '',
    },
  ],
}

export class AwsAlertSampleStack extends TerraformStack {
  constructor(scope: Construct, name: string, config: LambdaFunctionConfig) {
    super(scope, name)

    new provider.AwsProvider(this, 'awsProvider', {
      region: 'ap-northeast-1',
    })

    const asset = new TerraformAsset(this, 'lambdaAsset', {
      path: path.resolve(__dirname, config.path),
      type: AssetType.ARCHIVE,
    })

    const bucket = new s3Bucket.S3Bucket(this, 'bucket', {
      bucketPrefix: `cdktf-${name}-bucket`,
    })

    const lambdaArchive = new s3Object.S3Object(this, 'lambdaArchive', {
      bucket: bucket.bucket,
      key: `${config.version}/${asset.fileName}`,
      source: asset.path,
    })

    const role = new iamRole.IamRole(this, 'lambdaExec', {
      name: `cdktf-${name}-role`,
      assumeRolePolicy: JSON.stringify(lambdaRolePolicy),
    })

    const iamPolicy = new iamRolePolicyAttachment.IamRolePolicyAttachment(
      this,
      'lambda-managed-policy',
      {
        policyArn:
          'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
        role: role.name,
      }
    )

    const cloudWatchLogGroup = new cloudwatchLogGroup.CloudwatchLogGroup(
      this,
      'cdktf-cloudwatch-log-group',
      {
        name: `/aws/lambda/cdktf-${name}`,
      }
    )

    new lambdaFunction.LambdaFunction(this, 'cdktf-lambda', {
      functionName: `cdktf-${name}`,
      s3Bucket: bucket.bucket,
      s3Key: lambdaArchive.key,
      handler: config.handler,
      runtime: config.runtime,
      role: role.arn,
      dependsOn: [iamPolicy, cloudWatchLogGroup],
    })

    // SNSトピック作成
    const pagerdutySnsTopic = new snsTopic.SnsTopic(
      this,
      'cdktf-lambda-error-to-pagerduty',
      {
        name: 'cdktf-lambda-error-to-pagerduty',
      }
    )
    new snsTopicSubscription.SnsTopicSubscription(
      this,
      'cdktf-lambda-error-to-pagerduty-subscription',
      {
        // PagerDutyの決まったEndpoint形式にする必要がある
        // @see https://registry.terraform.io/providers/PagerDuty/pagerduty/latest/docs/resources/service_integration#attributes-reference
        endpoint: `https://events.pagerduty.com/integration/${config.integration.integrationKey}/enqueue`,
        protocol: 'https',
        topicArn: pagerdutySnsTopic.arn,
      }
    )

    const errorMetricFilter =
      new cloudwatchLogMetricFilter.CloudwatchLogMetricFilter(
        this,
        'cdktf-lambda-error-metric-filter',
        {
          name: `cdktf-${name}-metric-filter`,
          pattern: 'ERROR',
          logGroupName: cloudWatchLogGroup.name,
          metricTransformation: {
            name: `cdktf-${name}-metric-filter`,
            namespace: 'Lambda',
            value: '1',
            defaultValue: '0',
          },
        }
      )

    new cloudwatchMetricAlarm.CloudwatchMetricAlarm(
      this,
      'cdktf-pagerduty-aws-lambda-error-alert',
      {
        alarmName: 'cdktf-pagerduty-aws-lambda-error-alert',
        comparisonOperator: 'GreaterThanOrEqualToThreshold',
        evaluationPeriods: 1,
        threshold: 1,
        metricName: errorMetricFilter.name,
        namespace: 'Lambda',
        period: 30,
        statistic: 'Sum',
        alarmActions: [pagerdutySnsTopic.arn],
      }
    )
  }
}
