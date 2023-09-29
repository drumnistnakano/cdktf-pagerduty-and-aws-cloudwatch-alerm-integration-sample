# Install

```
$ npm install
```

# Deploy

```
$ export TF_VAR_PAGERDUTY_TOKEN='PagerDutyコンソールから取得したAPI Key'
$ aws sts get-caller-identity # AWS認証情報が設定されているか確認
$ cdktf deploy pagerduty-cdktf-sample aws-alert-sample-stack

# 途中デプロイの許可の確認があるので、Approve を選択して Enter
```

# Diagram

```mermaid
graph TD;
  subgraph PagerDuty
    B[users] -->|Belongs to| C[teamOnCall]
    C -->|Has| D[escalationPolicy]
    F[onCallTechnicalService] -->|Belongs to| E[onCallBusinessService]
    D --> F
    C -->|Has| E
    F -->|Integration with| G[PagerDuty Integration]
  end

  subgraph AWS
    I[S3 Bucket] -->|Contains| J[Lambda Archive]
    J -->|Is Executed by| K[AWS Lambda]
    K -->|Writes to| L[CloudWatch Logs Group]
    L -->|Trigger by Cloudwatch Metricfilter on the keyword `ERROR`　| M[SNS Topic]
  end

  C -->|Subscribes to| G;
  M -->|Sends messages to| G;

  style B fill:#99ff99,stroke:#4caf50,stroke-width:3px;
  style C fill:#99ff99,stroke:#4caf50,stroke-width:2px;
  style D fill:#99ff99,stroke:#4caf50,stroke-width:2px;
  style E fill:#99ff99,stroke:#4caf50,stroke-width:2px;
  style F fill:#99ff99,stroke:#4caf50,stroke-width:2px;
  style G fill:#ffcc00,stroke:#e68a00,stroke-width:2px;
  style I fill:#80bfff,stroke:#007acc,stroke-width:2px;
  style J fill:#80bfff,stroke:#007acc,stroke-width:2px;
  style K fill:#80bfff,stroke:#007acc,stroke-width:2px;
  style L fill:#80bfff,stroke:#007acc,stroke-width:2px;
  style M fill:#80bfff,stroke:#007acc,stroke-width:2px;


```
