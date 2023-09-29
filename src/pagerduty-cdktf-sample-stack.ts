import { Construct } from 'constructs'
import { TerraformStack, TerraformVariable } from 'cdktf'
import {
  provider,
  businessService,
  serviceDependency,
  service,
  escalationPolicy,
  schedule,
  user,
  teamMembership,
  dataPagerdutyUser,
  serviceIntegration,
  team,
  dataPagerdutyVendor,
} from '@cdktf/provider-pagerduty'
import { DataPagerdutyUser } from '@cdktf/provider-pagerduty/lib/data-pagerduty-user'
import { ServiceIntegration } from '@cdktf/provider-pagerduty/lib/service-integration'

interface CreateUsersProps {
  construct: Construct
}

/**
 * PagerDutyコンソール作成したユーザー読み込み
 * @param {CreateUsersProps} { construct }
 * @return {*}  {DataPagerdutyUser[]}
 */
const loadUsers = ({ construct }: CreateUsersProps): DataPagerdutyUser[] => {
  const users = [
    new dataPagerdutyUser.DataPagerdutyUser(construct, 'nakanoyoshiyuki', {
      email: 'nakano.yoshiyuki@sample.com',
    }),
    new dataPagerdutyUser.DataPagerdutyUser(construct, 'nakanoyoshiyuki2', {
      email: 'nakano.yoshiyuki2@sample.com',
    }),
  ]
  return users
}

export class PagerdutyCdktfSampleStack extends TerraformStack {
  public integration: ServiceIntegration

  constructor(scope: Construct, id: string) {
    super(scope, id)

    const pagerdutyToken = new TerraformVariable(this, 'PAGERDUTY_TOKEN', {
      type: 'string',
      description: 'Pagerduty Token for cdktf deploy',
      sensitive: true,
    })
    new provider.PagerdutyProvider(this, 'pagerdutyProvider', {
      token: pagerdutyToken.value,
    })

    // ユーザー取得
    const users = loadUsers({ construct: this })

    // チーム取得
    const teamOnCall = new team.Team(this, 'teamOnCall', {
      name: 'teamOnCall',
    })

    // チーム所属
    users.map(
      (user) =>
        new teamMembership.TeamMembership(
          this,
          // @see https://stackoverflow.com/questions/61957767/aws-cdk-cannot-use-tokens-in-construct-id-how-do-i-dynamically-name-construc
          `cltTeamMemberShip${user.node.id}`,
          {
            teamId: teamOnCall.id,
            userId: user.id,
          }
        )
    )

    // オンコール用Business Service作成
    const onCallBusinessService = new businessService.BusinessService(
      this,
      'onCallBusinessService',
      {
        name: 'onCallBusinessService',
        team: teamOnCall.id,
      }
    )

    // サービスのオンコールシフト作成
    const onCallShift = new schedule.Schedule(this, 'onCallShift', {
      timeZone: 'Asia/Tokyo',
      layer: [
        {
          name: 'basicOnCallShift',
          rotationTurnLengthSeconds: 3600,
          rotationVirtualStart: '2023-09-16T00:00:00+09:00',
          start: '2023-09-16T00:00:00+09:00',
          users: users.map((user) => user.id),
        },
      ],
    })

    // オンコールチームのエスカレーションポリシー作成
    const teamOnCallEscalationPolicy = new escalationPolicy.EscalationPolicy(
      this,
      'teamOnCallEscalationPolicy',
      {
        name: 'teamOnCallEscalationPolicy',
        numLoops: 2,
        rule: [
          {
            escalationDelayInMinutes: 30,
            target: [
              {
                id: onCallShift.id,
                type: 'schedule_reference',
              },
            ],
          },
        ],
        teams: [teamOnCall.id],
      }
    )

    // オンコール用Technical Service作成
    const onCallTechnicalService = new service.Service(
      this,
      'onCallTechnicalService',
      {
        name: 'onCallTechnicalService',
        escalationPolicy: teamOnCallEscalationPolicy.id,
      }
    )

    // Business ServiceとTechnical Serviceの依存関係定義
    new serviceDependency.ServiceDependency(this, 'serviceDependencies', {
      dependency: {
        dependentService: [
          {
            type: 'business_service',
            id: onCallBusinessService.id,
          },
        ],
        supportingService: [
          {
            type: 'service',
            id: onCallTechnicalService.id,
          },
        ],
      },
    })

    // CloudWatchのVendor指定
    const cloudwatch = new dataPagerdutyVendor.DataPagerdutyVendor(
      this,
      'vendor',
      {
        name: 'Amazon CloudWatch',
      }
    )

    // PagerDutyのServiceIntegrationにCloudWatchを追加
    this.integration = new serviceIntegration.ServiceIntegration(
      this,
      'serviceIntegration',
      {
        service: onCallTechnicalService.id,
        vendor: cloudwatch.id,
      }
    )
  }
}
