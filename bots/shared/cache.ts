import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from '@aws-sdk/lib-dynamodb';

let documentClient: DynamoDBDocumentClient;

const setupDynamoDB = () => {
  if (!documentClient) {
    const dynamoDbClient = new DynamoDBClient({});
    documentClient = DynamoDBDocumentClient.from(dynamoDbClient);
  }

  return documentClient;
};

const getVal = async (
  botApiDialogId = 0,
  token = process.env.BOT_TOKEN,
  cacheTable = process.env.DYNAMODB_CACHE_TABLE,
) => {
  if (!token) {
    throw new Error('Telegram Bot token not provided!');
  }
  if (!cacheTable) {
    throw new Error('Cache table not provided!');
  }

  const ddb = setupDynamoDB();

  const { Item } = await ddb.send(
    new GetCommand({
      TableName: cacheTable,
      Key: {
        botToken: `bot${token}`,
        botApiDialogId,
      },
    }),
  );

  return Item?.val;
};

export const getItem = async <T>(
  key?: string,
  botApiDialogId = 0,
  token = process.env.BOT_TOKEN,
  cacheTable = process.env.DYNAMODB_CACHE_TABLE,
): Promise<T | undefined> => {
  const val = await getVal(botApiDialogId, token, cacheTable);

  return key ? val?.[key] : val;
};

export const setItem = async <T>(
  key: string | undefined,
  value: T,
  botApiDialogId = 0,
  token = process.env.BOT_TOKEN,
  cacheTable = process.env.DYNAMODB_CACHE_TABLE,
): Promise<void> => {
  const val = await getVal(botApiDialogId, token, cacheTable);
  const ddb = setupDynamoDB();

  await ddb.send(
    new PutCommand({
      TableName: cacheTable,
      Item: {
        botToken: `bot${token}`,
        botApiDialogId,
        val: {
          ...val,
          ...(key ? { [key]: value } : value),
        },
      },
    }),
  );
};
