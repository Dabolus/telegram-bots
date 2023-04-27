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
      Key: { botToken: `bot${token}` },
    }),
  );

  return Item?.val;
};

export const getItem = async <T>(
  key: string,
  token = process.env.BOT_TOKEN,
  cacheTable = process.env.DYNAMODB_CACHE_TABLE,
): Promise<T | undefined> => {
  const val = await getVal(token, cacheTable);

  return val?.[key];
};

export const setItem = async <T>(
  key: string,
  value: T,
  token = process.env.BOT_TOKEN,
  cacheTable = process.env.DYNAMODB_CACHE_TABLE,
): Promise<void> => {
  if (!token) {
    throw new Error('Telegram Bot token not provided!');
  }
  if (!cacheTable) {
    throw new Error('Cache table not provided!');
  }

  const ddb = setupDynamoDB();

  const val = await getVal(token, cacheTable);

  await ddb.send(
    new PutCommand({
      TableName: cacheTable,
      Item: {
        botToken: `bot${token}`,
        val: {
          ...val,
          [key]: value,
        },
      },
    }),
  );
};
