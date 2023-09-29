import { Handler } from 'aws-lambda'

export const handler: Handler = async (): Promise<void> => {
  console.error('エラーになりました。終了します')
}
