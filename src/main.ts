import { AwsAlertSampleStack } from './lambda-alert-sample-stack'
import { PagerdutyCdktfSampleStack } from './pagerduty-cdktf-sample-stack'
import { App } from 'cdktf'

const app = new App()
const result = new PagerdutyCdktfSampleStack(app, 'pagerduty-cdktf-sample')
new AwsAlertSampleStack(app, 'aws-alert-sample-stack', {
  path: '../lambda/lambda-error-alert/dist',
  handler: 'index.handler',
  runtime: 'nodejs18.x',
  stageName: 'aws-error-alert',
  version: 'v0.0.1',
  integration: result.integration,
})
app.synth()
